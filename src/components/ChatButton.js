import React, { useState, useRef, useEffect } from 'react';
import './ChatButton.css';

const ChatMessage = ({ message, isBot = false, isTyping = false }) => {
  const [displayText, setDisplayText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!isBot || !message) return;
    
    setDisplayText('');
    setCurrentIndex(0);
    
    if (isTyping) {
      const timer = setInterval(() => {
        if (currentIndex < message.length) {
          setDisplayText(prev => prev + message[currentIndex]);
          setCurrentIndex(prev => prev + 1);
        } else {
          clearInterval(timer);
        }
      }, 20); // Adjust typing speed here (lower = faster)
      
      return () => clearInterval(timer);
    } else {
      setDisplayText(message);
    }
  }, [message, isBot, isTyping, currentIndex]);

  return (
    <div className={`chat-message ${isBot ? 'bot-message' : 'user-message'}`}>
      <div className="message-content">
        {isTyping && currentIndex < message.length ? displayText : message}
      </div>
    </div>
  );
};

const ChatButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { text: 'Hello! How can I help you today?', isBot: true }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const handleClick = () => {
    setIsOpen(!isOpen);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    
    // Add user message
    const userMessage = { text: inputValue, isBot: false };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);
    
    // Simulate bot response after a short delay
    setTimeout(() => {
      const botResponses = [
        'I understand your question. Let me check that for you.',
        'Thanks for reaching out! I\'ll look into this.',
        'That\'s a great question! Here\'s what I found...',
        'I\'m here to help with that.',
        'Let me find the best solution for you.'
      ];
      const randomResponse = botResponses[Math.floor(Math.random() * botResponses.length)];
      
      setMessages(prev => [...prev, { text: randomResponse, isBot: true }]);
      setIsTyping(false);
    }, 1000);
  };

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  return (
    <>
      <button 
        className={`chat-button ${isOpen ? 'active' : ''}`} 
        onClick={handleClick}
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
      >
        <svg 
          className="chat-icon" 
          viewBox="0 0 24 24" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" />
        </svg>
      </button>
      
      {isOpen && (
        <div className="chat-popup">
          <div className="chat-header">
            <h3>Support Chat</h3>
            <button onClick={() => setIsOpen(false)} className="close-button">
              ×
            </button>
          </div>
          <div className="chat-messages">
            {messages.map((message, index) => (
              <ChatMessage 
                key={index} 
                message={message.text} 
                isBot={message.isBot} 
              />
            ))}
            {isTyping && (
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          <form onSubmit={handleSubmit} className="chat-input-container">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Type your message..."
              className="chat-input"
            />
            <button type="submit" className="send-button">
              <svg viewBox="0 0 24 24" className="send-icon">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
};

export default ChatButton;
