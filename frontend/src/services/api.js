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
  getThumbnail: (pdfId) => api.get(`/api/pdfs/${pdfId}/thumbnail`, { responseType: 'blob' }),
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
      
      // Create a URL with parameters instead of POST body
      // because EventSource only supports GET requests
      const params = new URLSearchParams({
        query: question,
        use_tools: use_tools.toString(),
        detailed_response: detailed_response.toString()
      });
      
      // Add authorization header to request
      const headers = {
        'Accept': 'text/event-stream',
        'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`
      };
      
      let source;
      try {
        // Use EventSourcePolyfill to support headers and POST
        // You'll need to install: npm install eventsource-polyfill
        // For now, we'll use a simplified approach with fetch
        
        // Track if the stream is active
        let isActive = true;
        
        // Create request body
        const requestBody = {
          query: question,
          conversation_history,
          context: selected_text ? [selected_text] : [],
          use_tools,
          detailed_response,
          current_page
        };
        
        console.log('Starting stream request to', `${API_URL}/api/pdfs/${pdfId}/chat`);
        
        // Use fetch streaming as a simple alternative
        fetch(`${API_URL}/api/pdfs/${pdfId}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
            'Accept': 'text/event-stream'
          },
          body: JSON.stringify(requestBody)
        })
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          console.log('Stream connected, processing data...');
          
          // Create a reader from the response body
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          
          // Process the stream
          function processStream() {
            // If stream was cancelled, stop processing
            if (!isActive) return;
            
            reader.read().then(({ done, value }) => {
              if (done) {
                console.log('Stream finished');
                if (isActive && onComplete) onComplete();
                return;
              }
              
              try {
                // Decode binary chunk to text
                const chunk = decoder.decode(value, { stream: true });
                console.log('Received chunk:', chunk);
                
                // Process chunk line by line (SSE format)
                const lines = chunk.split('\n');
                
                for (let i = 0; i < lines.length; i++) {
                  const line = lines[i].trim();
                  
                  // Skip empty lines
                  if (!line) continue;
                  
                  // Check for data prefix (SSE format)
                  if (line.startsWith('data:')) {
                    const data = line.substring(5).trim();
                    
                    // Check for stream end marker
                    if (data === '[DONE]') {
                      console.log('Received [DONE] signal');
                      if (isActive && onComplete) onComplete();
                      return;
                    }
                    
                    try {
                      // Parse the JSON data
                      const parsedData = JSON.parse(data);
                      console.log('Parsed data:', parsedData);
                      
                      // Process the response text
                      if (parsedData && parsedData.response !== undefined && isActive) {
                        onMessage(parsedData.response);
                      }
                    } catch (err) {
                      console.warn('Error parsing SSE data:', err, data);
                    }
                  }
                }
                
                // Continue reading
                processStream();
              } catch (error) {
                console.error('Error processing stream chunk:', error);
                if (isActive && onError) onError(error);
              }
            }).catch(error => {
              if (error.name !== 'AbortError' && isActive && onError) {
                console.error('Stream read error:', error);
                onError(error);
              }
            });
          }
          
          // Start processing the stream
          processStream();
        })
        .catch(error => {
          console.error('Stream connection error:', error);
          if (isActive && onError) onError(error);
        });
        
        // Return control object
        return {
          cancel: () => {
            console.log('Cancelling stream request');
            isActive = false;
          }
        };
      } catch (error) {
        console.error('Error setting up stream:', error);
        if (onError) onError(error);
        return null;
      }
    };
    
    return {
      regular: regularRequest,
      stream: streamRequest
    };
  },
};

export default api; 