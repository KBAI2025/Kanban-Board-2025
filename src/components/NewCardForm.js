import { useState } from 'react';
import axios from 'axios';
import './NewCardForm.css';

export default function NewCardForm({ columnId, boardId, onCardAdded }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setIsSubmitting(true);
    setError('');
    
    try {
      const response = await axios.post('/api/cards', { 
        title: title.trim(), 
        description: description.trim(),
        columnId,
        boardId
      });
      
      // Clear the form
      setTitle('');
      setDescription('');
      
      // Notify parent component
      if (onCardAdded) {
        onCardAdded(response.data);
      }
      
    } catch (error) {
      console.error('Failed to create card:', error);
      setError(error.response?.data?.message || 'Failed to create card. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="new-card-form">
      <h3>Add New Card</h3>
      {error && <div className="error-message">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <input
            type="text"
            placeholder="Card title *"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isSubmitting}
            className="form-input"
          />
        </div>
        <div className="form-group">
          <textarea
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isSubmitting}
            className="form-textarea"
            rows="3"
          />
        </div>
        <div className="form-actions">
          <button 
            type="submit" 
            disabled={isSubmitting || !title.trim()}
            className="submit-button"
          >
            {isSubmitting ? 'Adding...' : 'Add Card'}
          </button>
        </div>
      </form>
    </div>
  );
}
