import React, { useState } from 'react';
import { addCardToColumn } from '../services/api';
import './AddCard.css';

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

const AddCard = ({ boardId, columnId, onCardAdded }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assignee: '',
    priority: 'medium',
    epicLabel: ''
  });
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Reset previous errors
    setError('');
    
    // Validate required fields
    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }
    
    if (!formData.epicLabel.trim()) {
      setError('Epic Label is required');
      return;
    }

    try {
      setIsAdding(true);
      setError('');
      
      const selectedAssignee = TEAM_MEMBERS.find(member => member.id === formData.assignee);
      
      // The addCardToColumn function now returns the entire updated board
      const updatedBoard = await addCardToColumn(boardId, columnId, {
        title: formData.title.trim(),
        description: formData.description.trim(),
        priority: formData.priority,
        epicLabel: formData.epicLabel.trim(),
        assignee: selectedAssignee || null
      });
      
      // Pass the updated board to the parent component
      onCardAdded(updatedBoard);
      
      // Reset the form with default values
      setFormData({
        title: '',
        description: '',
        assignee: '',
        priority: 'medium',
        epicLabel: ''
      });
      setError('');  // Clear any remaining errors
      setShowForm(false);
    } catch (err) {
      console.error('Error adding card:', err);
      setError('Failed to add card. Please try again.');
    } finally {
      setIsAdding(false);
    }
  };

  if (!showForm) {
    return (
      <button 
        className="add-card-button" 
        onClick={() => setShowForm(true)}
      >
        + Add a card
      </button>
    );
  }

  return (
    <div className="add-card">
      {error && <div className="error-message" style={{
        color: '#e53e3e',
        backgroundColor: '#fff5f5',
        padding: '10px 15px',
        borderRadius: '6px',
        marginBottom: '15px',
        fontSize: '14px',
        borderLeft: '3px solid #e53e3e'
      }}>{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="required-field">Card Title</label>
          <input
            type="text"
            name="title"
            placeholder="Enter card title"
            value={formData.title}
            onChange={handleChange}
            disabled={isAdding}
            className={error && !formData.title.trim() ? 'error' : ''}
            required
          />
        </div>
        
        <div className="form-group">
          <textarea
            name="description"
            placeholder="Description"
            value={formData.description}
            onChange={handleChange}
            disabled={isAdding}
            rows="3"
          />
        </div>
        
        <div className="form-group">
          <label>Assignee</label>
          <select
            name="assignee"
            value={formData.assignee}
            onChange={handleChange}
            disabled={isAdding}
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
                  disabled={isAdding}
                />
                <span className="priority-dot" style={{ backgroundColor: option.color }}></span>
                {option.label}
              </label>
            ))}
          </div>
        </div>
        
        <div className="form-group">
          <label className="required-field">Epic Label</label>
          <select
            name="epicLabel"
            value={formData.epicLabel}
            onChange={handleChange}
            disabled={isAdding}
            className={error && !formData.epicLabel.trim() ? 'error' : ''}
            required
          >
            <option value="">Select an Epic Label</option>
            <option value="UI/UX">UI/UX</option>
            <option value="Frontend">Frontend</option>
            <option value="Backend">Backend</option>
            <option value="Bug">Bug</option>
            <option value="Feature">Feature</option>
          </select>
        </div>
        
        <div className="form-actions">
          <button type="submit" className="primary" disabled={isAdding}>
            {isAdding ? 'Adding...' : 'Add Card'}
          </button>
          <button 
            type="button" 
            className="secondary"
            onClick={() => {
              setFormData({
                title: '',
                description: '',
                assignee: '',
                priority: 'medium',
                epicLabel: ''
              });
              setError('');
              setShowForm(false);
            }}
            disabled={isAdding}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddCard;
