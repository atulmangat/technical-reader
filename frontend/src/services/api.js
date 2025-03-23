import axios from 'axios';

const API_URL = 'http://localhost:8080';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: false, // Changed to false as we're using Authorization header
});

// Add request interceptor to add auth token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    console.log('Request to:', config.url);
    console.log('Token from localStorage:', token);
    
    if (token) {
      // Always use the Bearer prefix format regardless of how the token is stored
      // This ensures consistency in the Authorization header
      if (token.startsWith('Bearer ')) {
        config.headers.Authorization = token;
      } else {
        config.headers.Authorization = `Bearer ${token}`;
      }
      
      // Log the final Authorization header for debugging
      console.log('Final Authorization header:', config.headers.Authorization);
    } else {
      console.log('No token found in localStorage');
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor for debugging
api.interceptors.response.use(
  (response) => {
    console.log('Response from:', response.config.url, 'Status:', response.status);
    return response;
  },
  (error) => {
    console.error('API Error:', error.config?.url, 'Status:', error.response?.status);
    console.error('Error details:', error.response?.data);
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (userData) => api.post('/api/auth/register', userData),
  login: (credentials) => api.post('/api/auth/login', credentials),
  googleLogin: (token) => api.post('/api/auth/google-login', { token }),
  checkAuth: () => api.get('/api/auth/check-auth'),
};

// User API
export const userAPI = {
  uploadAvatar: (formData) => {
    return api.post('/api/users/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  updateProfile: (userData) => api.put('/api/users/profile', userData),
  getProfile: () => api.get('/api/users/profile'),
  // User preferences API
  getPreferences: () => api.get('/api/users/preferences'),
  updatePreferences: (preferences) => api.put('/api/users/preferences', { preferences }),
};

// PDF API
export const pdfAPI = {
  getAllPdfs: (skip = 0, limit = 20) => api.get(`/api/pdfs/?skip=${skip}&limit=${limit}`),
  getPdf: (id) => api.get(`/api/pdfs/${id}`, { responseType: 'blob' }),
  uploadPdf: (formData) => {
    return api.post('/api/pdfs/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  getThumbnail: (pdfId) => {
    // Enhanced thumbnail fetch with timeout and better error handling
    return api.get(`/api/pdfs/${pdfId}/thumbnail`, { 
      responseType: 'blob',
      timeout: 10000, // 10 second timeout
      validateStatus: function (status) {
        return status >= 200 && status < 300; // Only resolve for success status codes
      }
    });
  },
  deletePdf: (pdfId) => api.delete(`/api/pdfs/${pdfId}`),
  renamePdf: (pdfId, newTitle) => api.patch(`/api/pdfs/${pdfId}`, { title: newTitle }),
};

// Notes API
export const notesAPI = {
  getNotesByPdf: (pdfId) => api.get(`/api/pdfs/${pdfId}/notes`),
  createNote: (pdfId, noteData) => api.post(`/api/pdfs/${pdfId}/notes`, noteData),
  updateNote: (pdfId, noteId, noteData) => api.put(`/api/pdfs/${pdfId}/notes/${noteId}`, noteData),
  deleteNote: (pdfId, noteId) => api.delete(`/api/pdfs/${pdfId}/notes/${noteId}`),
};

// Highlights API
export const highlightsAPI = {
  getHighlightsByPdf: (pdfId) => api.get(`/api/pdfs/${pdfId}/highlights`),
  createHighlight: (pdfId, highlightData) => api.post(`/api/pdfs/${pdfId}/highlights`, highlightData),
  updateHighlight: (pdfId, highlightId, highlightData) => api.put(`/api/pdfs/${pdfId}/highlights/${highlightId}`, highlightData),
  deleteHighlight: (pdfId, highlightId) => api.delete(`/api/pdfs/${pdfId}/highlights/${highlightId}`),
};

// RAG API
export const ragAPI = {
  query: (pdfId, question, options = {}) => {
    const { conversation_history = [], selected_text = '', use_tools = true, detailed_response = false, current_page = null } = options;
    
    // Regular, non-streaming version (used as a fallback)
    const regularRequest = () => {
      return api.post(`/api/pdfs/${pdfId}/chat`, { 
        query: question,
        conversation_history,
        context: selected_text ? [selected_text] : [],
        use_tools,
        detailed_response,
        current_page
      });
    };
    
    // Streaming version using EventSource (for browsers) or fetch (for Node.js)
    const streamRequest = (onMessage, onError, onComplete) => {
      // Get token for authorization
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No authentication token found');
        if (onError) onError(new Error("No authentication token found"));
        return null;
      }
      
      // Create the request options
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify({
          query: question,
          conversation_history,
          context: selected_text ? [selected_text] : [],
          use_tools,
          detailed_response,
          current_page
        })
      };
      
      // Create an AbortController to allow cancellation
      const controller = new AbortController();
      const { signal } = controller;
      
      // Add the signal to the request options
      requestOptions.signal = signal;
      
      // Start the fetch request
      fetch(`${API_URL}/api/pdfs/${pdfId}/chat`, requestOptions)
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          
          // Create a reader for the response body stream
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          
          // Function to read the stream
          function readStream() {
            reader.read().then(({ done, value }) => {
              if (done) {
                // Handle any remaining buffer data
                if (buffer.trim()) {
                  try {
                    const lines = buffer.split('\n\n');
                    for (const line of lines) {
                      if (line.trim().startsWith('data:')) {
                        const data = line.replace(/^data: /, '').trim();
                        if (data === '[DONE]') {
                          if (onComplete) onComplete();
                          return;
                        }
                        try {
                          const parsed = JSON.parse(data);
                          if (parsed.response) {
                            onMessage(parsed.response);
                          }
                        } catch (e) {
                          console.warn('Could not parse stream data:', data);
                        }
                      }
                    }
                  } catch (e) {
                    console.error('Error processing final buffer:', e);
                  }
                }
                
                if (onComplete) onComplete();
                return;
              }
              
              // Decode the chunk and add it to the buffer
              const chunk = decoder.decode(value, { stream: true });
              buffer += chunk;
              
              // Process complete events in the buffer
              const lines = buffer.split('\n\n');
              buffer = lines.pop() || ''; // Keep the last incomplete chunk in the buffer
              
              for (const line of lines) {
                if (line.trim().startsWith('data:')) {
                  const data = line.replace(/^data: /, '').trim();
                  if (data === '[DONE]') {
                    if (onComplete) onComplete();
                    return;
                  }
                  try {
                    const parsed = JSON.parse(data);
                    if (parsed.response) {
                      onMessage(parsed.response);
                    }
                  } catch (e) {
                    console.warn('Could not parse stream data:', data);
                  }
                }
              }
              
              // Continue reading
              readStream();
            }).catch(error => {
              if (error.name === 'AbortError') {
                console.log('Stream aborted by user');
              } else {
                console.error('Error reading stream:', error);
                if (onError) onError(error);
              }
            });
          }
          
          // Start reading the stream
          readStream();
        })
        .catch(error => {
          console.error('Fetch error:', error);
          if (onError) onError(error);
        });
      
      // Return control object with cancel method
      return {
        cancel: () => {
          console.log('Cancelling stream request');
          controller.abort();
        }
      };
    };
    
    return {
      regular: regularRequest,
      stream: streamRequest
    };
  },
};

export default api; 