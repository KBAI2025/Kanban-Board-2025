import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5002';

// Create a card in the specified column
export const createCard = async (cardData) => {
  try {
    const response = await axios.post(`${API_URL}/api/cards`, cardData);
    return response.data;
  } catch (error) {
    console.error('Error creating card:', error);
    throw error;
  }
};

// Get all cards for a board
export const getCardsByBoard = async (boardId) => {
  try {
    const response = await axios.get(`${API_URL}/api/boards/${boardId}/cards`);
    return response.data;
  } catch (error) {
    console.error('Error fetching cards:', error);
    throw error;
  }
};

// Update a card
export const updateCard = async (cardId, updates) => {
  try {
    const response = await axios.put(`${API_URL}/api/cards/${cardId}`, updates);
    return response.data;
  } catch (error) {
    console.error('Error updating card:', error);
    throw error;
  }
};

// Delete a card
export const deleteCard = async (cardId) => {
  try {
    const response = await axios.delete(`${API_URL}/api/cards/${cardId}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting card:', error);
    throw error;
  }
};
