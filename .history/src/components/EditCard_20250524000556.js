import React, { useState, useEffect } from 'react';
import { updateCard } from '../services/api';
import './EditCard.css';
import { format } from 'date-fns';

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', color: '#4CAF50' },
  { value: 'medium', label: 'Medium', color: '#2196F3' },
  { value: 'high', label: 'High', color: '#FF9800' },
  { value: 'critical', label: 'Critical', color: '#F44336' },
];

const TEAM_MEMBERS = [
  { id: 'user1', name: 'John Doe', avatar: 'JD' },
  { id: 'user2', name: 'Jane Smith', avatar: 'JS' },
  { id: 'user3', name: 'Bob Johnson', avatar: 'BJ' },
  { id: 'user4', name: 'Alice Williams', avatar: 'AW' },
];

const EditCard = ({ 
  boardId, 
  columnId, 
  card, 
  onSave, 
  onCancel,
  onDelete
}) => {
  const [formData, setFormData] = useState({
    title: card.title || '',
    description: card.description || '',
    priority: card.priority || 'medium',
    epicLabel: card.epicLabel || '',
    assignee: card.assignee?.id || ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // Use ref to track mounted state
  const isMounted = React.useRef(true);
  
  useEffect(() => {
    // Set mounted to true when component mounts
    isMounted.current = true;
    
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleEscape);
    
    // Cleanup function
    return () => {
      // Set mounted to false when component unmounts
      isMounted.current = false;
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onCancel]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('handleSubmit called with formData:', formData);
    
    if (!formData.title.trim()) {
      console.log('Validation failed: Title is required');
      setError('Title is required');
      return;
    }

    // Create a cleanup flag for this operation
    let isSubscribed = true;
    
    try {
      console.log('Starting save process...');
      setIsSaving(true);
      setError('');
      
      const selectedAssignee = TEAM_MEMBERS.find(member => member.id === formData.assignee);
      console.log('Selected assignee:', selectedAssignee);
      
      const cardUpdateData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        priority: formData.priority,
        epicLabel: formData.epicLabel.trim(),
        assignee: selectedAssignee || null
      };
      
      console.log('Calling updateCard with:', { 
        boardId, 
        columnId, 
        cardId: card.id, 
        cardData: cardUpdateData 
      });
      
      const updatedCard = await updateCard(boardId, columnId, card.id, cardUpdateData);
      
      // Only update state if component is still mounted and operation wasn't cancelled
      if (isMounted.current && isSubscribed) {
        console.log('updateCard completed, updatedCard:', updatedCard);
        console.log('Calling onSave with updated card');
        onSave(updatedCard);
      }
    } catch (err) {
      // Only update state if component is still mounted and operation wasn't cancelled
      if (isMounted.current && isSubscribed) {
        console.error('Error in handleSubmit:', {
          message: err.message,
          response: err.response?.data,
          stack: err.stack
        });
        setError('Failed to save changes. Please try again.');
      }
    } finally {
      // Only update state if component is still mounted and operation wasn't cancelled
      if (isMounted.current && isSubscribed) {
        console.log('Save process completed, setting isSaving to false');
        setIsSaving(false);
      }
    }
    
    // Cleanup function for this operation
    return () => {
      isSubscribed = false;
    };
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this card?')) {
      // Create a cleanup flag for this operation
      let isSubscribed = true;
      
      try {
        if (isMounted.current) {
          setIsSaving(true);
        }
        
        // Pass the card ID to the onDelete callback
        await onDelete(card.id);
      } catch (err) {
        // Only update state if component is still mounted and operation wasn't cancelled
        if (isMounted.current && isSubscribed) {
          console.error('Error deleting card:', err);
          setError('Failed to delete card. Please try again.');
        }
      } finally {
        // Only update state if component is still mounted and operation wasn't cancelled
        if (isMounted.current && isSubscribed) {
          setIsSaving(false);
        }
      }
      
      // Cleanup function for this operation
      return () => {
        isSubscribed = false;
      };
    }
  };

  // Format the creation date
  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown date';
    try {
      const date = new Date(dateString);
      return format(date, 'PPpp'); // e.g., "May 16, 2025 at 4:32 PM"
    } catch (e) {
      console.error('Error formatting date:', e);
      return 'Unknown date';
    }
  };

  return (
    <div className="edit-card-overlay" onClick={onCancel}>
      <div className="edit-card" onClick={e => e.stopPropagation()}>
        <button className="close-button" onClick={onCancel}>×</button>
        
        <div className="edit-card-header">
          <div>
            <h3>Edit Card</h3>
            {card.createdAt && (
              <div className="creation-timestamp">
                Created: {formatDate(card.createdAt)}
              </div>
            )}
          </div>
        </div>
        
        {error && <div className="error-message">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Title</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="Card title"
              disabled={isSaving}
              autoFocus
              required
            />
          </div>
          
          <div className="form-group">
            <label>Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Add a detailed description..."
              disabled={isSaving}
              rows={4}
            />
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label>Assignee</label>
              <select
                name="assignee"
                value={formData.assignee}
                onChange={handleChange}
                disabled={isSaving}
              >
                <option value="">Unassigned</option>
                {TEAM_MEMBERS.map(member => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="form-group">
              <label>Priority</label>
              <div className="priority-options">
                {PRIORITY_OPTIONS.map(option => (
                  <label key={option.value} className="priority-option">
                    <input
                      type="radio"
                      name="priority"
                      value={option.value}
                      checked={formData.priority === option.value}
                      onChange={handleChange}
                      disabled={isSaving}
                    />
                    <span 
                      className="priority-dot" 
                      style={{ backgroundColor: option.color }}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
          
          <div className="form-group">
            <label>Epic Label</label>
            <select
              name="epicLabel"
              value={formData.epicLabel || 'None'}
              onChange={handleChange}
              disabled={isSaving}
              className="epic-label-select"
            >
              <option value="None">None</option>
              <option value="Backend">Backend</option>
              <option value="Frontend">Frontend</option>
              <option value="UI/UX">UI/UX</option>
              <option value="Accounting">Accounting</option>
            </select>
          </div>
          
          <div className="form-actions">
            <div className="left-actions">
              <button 
                type="button" 
                className="delete-button"
                onClick={handleDelete}
                disabled={isSaving}
              >
                Delete
              </button>
            </div>
            <div className="right-actions">
              <button 
                type="button" 
                className="secondary"
                onClick={onCancel}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="primary" 
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditCard;
