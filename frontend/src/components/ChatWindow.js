import React, { useState, useEffect, useRef, useCallback } from "react";
import { ragAPI, userAPI } from '../services/api';
import '../css/ChatWindow.css';
import { marked } from 'marked'; // Import marked for markdown rendering
import { useNavigate } from 'react-router-dom'; // Import useNavigate for navigation
import { Navbar } from './Navbar'; // Import Navbar component

export function ChatWindow({ initialContext, onAddNote, currentSelection, pdfId, currentPage }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [activeTab, setActiveTab] = useState('document'); // 'document', 'notes', or 'highlights'
    const [showTabInfo, setShowTabInfo] = useState(false); // State to track whether to show tab info
    const [exampleNotes, setExampleNotes] = useState([
        { id: 1, note: "This section explains the key concepts of transformer architecture", page_number: 12 },
        { id: 2, note: "Important definition of attention mechanism", page_number: 15 },
        { id: 3, note: "Results show significant improvement over baseline models", page_number: 28 }
    ]);
    const [exampleHighlights, setExampleHighlights] = useState([
        { id: 1, content: "Attention mechanisms allow the model to focus on different parts of the input sequence", color: "yellow", page_number: 15 },
        { id: 2, content: "Our model achieved 95.2% accuracy on the benchmark dataset", color: "green", page_number: 28 },
        { id: 3, content: "The limitations of this approach include increased computational complexity", color: "red", page_number: 32 }
    ]);
    const chatHistoryRef = useRef(null);
    const [streamController, setStreamController] = useState(null);
    const lastMessageRef = useRef(null); // Reference to the last message for scrolling
    const hasManuallyScrolled = useRef(false);
    // Track if we're receiving the first streaming response
    const isFirstStreamingResponse = useRef(false);
    const navigate = useNavigate(); // Initialize navigation
    const inputRef = useRef(null); // Reference for autofocus
    const chatWindowRef = useRef(null); // Reference for the chat window element
    const scrollAnchorRef = useRef(null); // Reference for scroll anchoring

    // Handle navigation to library
    const handleLibraryClick = useCallback(() => {
        navigate('/');
    }, [navigate]);

    // Initialize chat with welcome message
    const initializeChat = useCallback(() => {
        return [{
            type: 'assistant',
            text: 'How can I help you with this document?',
            timestamp: new Date().toISOString(),
            isLoading: false
        }];
    }, []);

    // Set initial message AFTER preferences have loaded
    useEffect(() => {
        if (messages.length === 0) {
            setMessages(initializeChat());
        }
    }, [initializeChat, messages.length]);

    // Focus input field when component mounts
    useEffect(() => {
        if (inputRef.current && activeTab === 'document') {
            inputRef.current.focus();
        }
    }, [activeTab]);

    // Add keyboard shortcut to stop streaming
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'Escape' && isStreaming) {
                handleStopStreaming();
            }
        };
        
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isStreaming, streamController]);

    // Add a function to show the "Saved" indicator briefly
    const showSavedIndicator = useCallback(() => {
        // No need to implement this function as it's no longer used
    }, []);

    // Handle tab switching
    const handleTabSwitch = useCallback((tabName) => {
        setActiveTab(tabName);
        
        // Focus the input after switching to document tab
        // Note: We don't reinitialize chat when switching back to document tab 
        // to preserve the conversation state between tab switches
        if (tabName === 'document') {
            setTimeout(() => {
                if (inputRef.current) {
                    inputRef.current.focus();
                }
            }, 100);
        }

        // Show info message for 20 seconds when tab is switched
        setShowTabInfo(true);
        setTimeout(() => {
            setShowTabInfo(false);
        }, 20000);
    }, []);

    const scrollToBottom = () => {
        if (chatHistoryRef.current) {
            // Use requestAnimationFrame to ensure the scroll happens after render
            requestAnimationFrame(() => {
                // Calculate if user has scrolled up manually (indicating they're reading previous messages)
                const { scrollTop, scrollHeight, clientHeight } = chatHistoryRef.current;
                const isScrolledToBottom = scrollHeight - scrollTop - clientHeight < 150; // Allow reasonable threshold
                
                // Only auto-scroll if already near the bottom or during first streaming
                if (isScrolledToBottom || (isStreaming && !hasManuallyScrolled.current)) {
                    chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
                }
            });
        }
    };

    // Add event listener to detect manual scrolling
    useEffect(() => {
        const chatHistory = chatHistoryRef.current;
        if (chatHistory) {
            const handleScroll = () => {
                const { scrollTop, scrollHeight, clientHeight } = chatHistory;
                // If user scrolls up more than 150px from the bottom, mark as manually scrolled
                hasManuallyScrolled.current = (scrollHeight - scrollTop - clientHeight) > 150;
            };
            
            chatHistory.addEventListener('scroll', handleScroll);
            return () => chatHistory.removeEventListener('scroll', handleScroll);
        }
    }, []);

    // Scroll to bottom when messages change (new message added)
    useEffect(() => {
        // Reset manual scroll flag when user sends a new message
        if (messages.length > 0 && messages[messages.length - 1].type === 'user') {
            hasManuallyScrolled.current = false;
        }
        scrollToBottom();
    }, [messages]);

    // More controlled scrolling approach during streaming
    useEffect(() => {
        if (isStreaming) {
            // Less frequent interval for smoother experience
            const scrollInterval = setInterval(scrollToBottom, 500);
            return () => clearInterval(scrollInterval);
        }
    }, [isStreaming]);

    // Handle component unmount - abort any active streams
    useEffect(() => {
        return () => {
            if (streamController) {
                streamController.cancel();
            }
        };
    }, [streamController]);

    const LoadingIndicator = () => (
        <div className="loading-indicator">
            <div className="loading-dot"></div>
            <div className="loading-dot"></div>
            <div className="loading-dot"></div>
            <span className="thinking-text">Thinking...</span>
        </div>
    );

    const StreamingIndicator = () => (
        <div className="streaming-indicator">
            <div className="streaming-pulse"></div>
        </div>
    );

    // Add AI avatar to messages
    const MessageAvatar = ({ type }) => {
        if (type === 'assistant') {
            return <div className="message-avatar ai-avatar"></div>;
        }
        return null;
    };

    const handleSend = async () => {
        if (!input.trim()) return;

        // Cancel any existing stream
        if (streamController) {
            streamController.cancel();
            setStreamController(null);
        }

        // Reset manual scroll tracking and set first streaming flag
        hasManuallyScrolled.current = false;
        isFirstStreamingResponse.current = true;

        const userMessage = {
            type: 'user',
            text: input,
            timestamp: new Date().toISOString()
        };

        const assistantMessage = {
            type: 'assistant',
            text: '',
            timestamp: new Date().toISOString(),
            isLoading: true,
            isStreaming: false
        };

        // Add messages to chat
        setMessages(prev => [...prev, userMessage, assistantMessage]);
        setInput('');
        setIsLoading(true);
        setIsStreaming(false);

        try {
            // Get all messages for conversation history
            const historyMessages = [...messages, userMessage];
            
            // Format conversation history for API
            const conversationHistory = historyMessages
                .filter(msg => msg.type === 'user' || msg.type === 'assistant')
                .map(msg => ({
                    role: msg.type === 'user' ? 'user' : 'assistant',
                    content: msg.text
                }));
                
            // Get any selected text as context
            const selectedText = historyMessages
                .filter(msg => msg.type === 'selection')
                .map(msg => msg.text)
                .join('\n\n');
            
            // Create API request object
            const apiRequest = ragAPI.query(pdfId, input, {
                conversation_history: conversationHistory,
                selected_text: selectedText,
                use_tools: true,
                current_page: currentPage
            });
            
            console.log('Starting streaming request...');
            
            // Store response text as it builds up
            let responseText = '';
            let hasReceivedFirstChunk = false;
            
            // Start the streaming request
            const controller = apiRequest.stream(
                // onMessage handler - called for each chunk
                (chunk) => {
                    console.log('Received chunk:', chunk);
                    
                    // Mark as streaming after first chunk
                    if (!hasReceivedFirstChunk) {
                        hasReceivedFirstChunk = true;
                        setIsStreaming(true);
                        
                        // Update the message to show it's no longer loading but streaming
                        setMessages(prev => {
                            const newMessages = [...prev];
                            const lastMessage = newMessages[newMessages.length - 1];
                            lastMessage.isLoading = false;
                            lastMessage.isStreaming = true;
                            return [...newMessages];
                        });
                        
                        // Always scroll to bottom at the start of streaming
                        requestAnimationFrame(scrollToBottom);
                    }
                    
                    responseText += chunk;
                    
                    // Update the assistant message with the partial response
                    setMessages(prev => {
                        const newMessages = [...prev];
                        const lastMessage = newMessages[newMessages.length - 1];
                        lastMessage.text = responseText;
                        return [...newMessages];
                    });
                    
                    // Limit how often we trigger scrolling during streaming to avoid interfering with input
                    // Only scroll every 100 characters and respect manual scrolling
                    if (responseText.length % 100 === 0) {
                        // If this is first content or user hasn't manually scrolled, scroll to bottom
                        if (isFirstStreamingResponse.current || !hasManuallyScrolled.current) {
                            requestAnimationFrame(scrollToBottom);
                        }
                    }
                    
                    // After receiving a few chunks, no longer consider this the first response
                    if (responseText.length > 300 && isFirstStreamingResponse.current) {
                        isFirstStreamingResponse.current = false;
                    }
                },
                // onError handler
                (error) => {
                    console.error('Error in streaming chat:', error);
                    
                    // Check if this is an abort error (user stopped the stream)
                    const wasAborted = error.name === 'AbortError' || error.message === 'The user aborted a request.';
                    
                    setMessages(prev => {
                        const newMessages = [...prev];
                        const lastMessage = newMessages[newMessages.length - 1];
                        
                        // Only add error message if it wasn't manually aborted
                        if (!wasAborted) {
                            lastMessage.text = `Error: ${error.message || 'Failed to stream response'}`;
                        }
                        
                        lastMessage.isLoading = false;
                        lastMessage.isStreaming = false;
                        return newMessages;
                    });
                    
                    setIsLoading(false);
                    setIsStreaming(false);
                    setStreamController(null);
                },
                // onComplete handler
                () => {
                    console.log('Stream completed');
                    setMessages(prev => {
                        const newMessages = [...prev];
                        const lastMessage = newMessages[newMessages.length - 1];
                        lastMessage.isLoading = false;
                        lastMessage.isStreaming = false;
                        return newMessages;
                    });
                    setIsLoading(false);
                    setIsStreaming(false);
                    setStreamController(null);
                    
                    // Final scroll to bottom when streaming completes, but only if user hasn't scrolled up
                    if (!hasManuallyScrolled.current) {
                        setTimeout(() => {
                            requestAnimationFrame(scrollToBottom);
                        }, 100);
                    }
                }
            );
            
            // Save controller reference to allow cancellation
            if (controller) {
                setStreamController(controller);
            } else {
                console.log('No controller returned, falling back to regular request');
                // Fallback to non-streaming request
                const response = await apiRequest.regular();
                
                console.log('Regular response received:', response.data);
                
                // Update the assistant message with the response
                setMessages(prev => {
                    const newMessages = [...prev];
                    const lastMessage = newMessages[newMessages.length - 1];
                    lastMessage.text = response.data.response || 'No response received';
                    lastMessage.isLoading = false;
                    lastMessage.isStreaming = false;
                    return newMessages;
                });
                setIsLoading(false);
                setIsStreaming(false);
            }
        } catch (error) {
            console.error('Error in chat:', error);
            setMessages(prev => {
                const newMessages = [...prev];
                const lastMessage = newMessages[newMessages.length - 1];
                lastMessage.text = `Error: ${error.message || 'Unknown error occurred'}`;
                lastMessage.isLoading = false;
                lastMessage.isStreaming = false;
                return newMessages;
            });
            setIsLoading(false);
            setIsStreaming(false);
            setStreamController(null);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const formatMessage = (message) => {
        if (!message) return '';
        
        // If message is a string, format it directly
        const messageText = typeof message === 'string' ? message : message.text || '';
        
        // Use marked to parse markdown
        let formattedText = marked.parse(messageText, {
            breaks: true,
            gfm: true
        });
        
        // Format page links
        formattedText = formattedText.replace(/PAGE (\d+)/g, (match, pageNum) => {
            return renderPageLink(pageNum);
        });
        
        return formattedText;
    };

    // Add stop streaming function
    const handleStopStreaming = () => {
        if (streamController) {
            console.log('Stopping stream...');
            streamController.cancel();
            setStreamController(null);
            
            // Update UI to show streaming has stopped
            setIsStreaming(false);
            setIsLoading(false);
            
            // Update the message to show it's no longer streaming and add a note
            setMessages(prev => {
                const newMessages = [...prev];
                const lastMessage = newMessages[newMessages.length - 1];
                lastMessage.isStreaming = false;
                // Add a note that streaming was stopped by the user
                lastMessage.text += '\n\n_[Response stopped by user]_';
                return [...newMessages];
            });
        }
    };

    // Generate page link for jumping to a specific page
    const renderPageLink = (pageNumber) => {
        return (
            <button 
                className="page-link-button" 
                onClick={() => console.log(`Navigate to page ${pageNumber}`)}
            >
                Page {pageNumber}
            </button>
        );
    };

    // Render the content based on active tab
    const renderTabContent = () => {
        switch(activeTab) {
            case 'document':
                return null; // Document Q&A tab content is handled separately
            case 'notes':
                return (
                    <div className="tab-content">
                        <div className="tab-content-header">
                            <h3>Your Notes</h3>
                        </div>
                        <div className="notes-list">
                            {exampleNotes.length > 0 ? (
                                exampleNotes.map(note => (
                                    <div key={note.id} className="note-item">
                                        <div className="note-content">{note.note}</div>
                                        <div className="note-meta">
                                            <button 
                                                className="page-link-button" 
                                                onClick={() => console.log(`Navigate to page ${note.page_number}`)}
                                            >
                                                Page {note.page_number}
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="empty-state">
                                    <div className="empty-icon">
                                        <span className="material-icons">note_add</span>
                                    </div>
                                    <p>You haven't added any notes yet.</p>
                                    <p className="empty-hint">Select text in the document and click "Add Note" to create your first note.</p>
                                </div>
                            )}
                        </div>
                    </div>
                );
            case 'highlights':
                return (
                    <div className="tab-content">
                        <div className="tab-content-header">
                            <h3>Your Highlights</h3>
                        </div>
                        <div className="highlights-list">
                            {exampleHighlights.length > 0 ? (
                                exampleHighlights.map(highlight => (
                                    <div key={highlight.id} className="highlight-item">
                                        <div className={`highlight-marker ${highlight.color}`}></div>
                                        <div className="highlight-content">{highlight.content}</div>
                                        <div className="highlight-meta">
                                            <button 
                                                className="page-link-button" 
                                                onClick={() => console.log(`Navigate to page ${highlight.page_number}`)}
                                            >
                                                Page {highlight.page_number}
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="empty-state">
                                    <div className="empty-icon">
                                        <span className="material-icons">highlight</span>
                                    </div>
                                    <p>You haven't highlighted any text yet.</p>
                                    <p className="empty-hint">Select text in the document and choose a highlight color to create your first highlight.</p>
                                </div>
                            )}
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="chat-window" ref={chatWindowRef}>
            <div className="chat-header">
                <div className="chat-header-main">
                    <div className="chat-header-left">
                        <div className="library-button" onClick={handleLibraryClick}>
                            <span className="material-icons">menu_book</span>
                            <span>Library</span>
                        </div>
                    </div>
                    
                    <div className="thinkpad-heading">
                        <span className="material-icons">psychology</span>
                        <h2>Thinkpad</h2>
                    </div>
                    
                    <div className="chat-header-right">
                        <div className="profile-section">
                            <span className="username">Atul</span>
                            <div className="profile-dropdown">
                                <button className="profile-button">
                                    <div className="avatar-container">
                                        <div className="avatar-placeholder">A</div>
                                    </div>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="chat-tabs">
                    <button 
                        className={`tab-button ${activeTab === 'document' ? 'active' : ''}`} 
                        onClick={() => handleTabSwitch('document')}
                    >
                        <span className="material-icons">question_answer</span>
                        <span className="tab-label">Document Q&A</span>
                    </button>
                    <button 
                        className={`tab-button ${activeTab === 'notes' ? 'active' : ''}`} 
                        onClick={() => handleTabSwitch('notes')}
                    >
                        <span className="material-icons">note</span>
                        <span className="tab-label">Notes</span>
                        {exampleNotes.length > 0 && <span className="tab-count">{exampleNotes.length}</span>}
                    </button>
                    <button 
                        className={`tab-button ${activeTab === 'highlights' ? 'active' : ''}`} 
                        onClick={() => handleTabSwitch('highlights')}
                    >
                        <span className="material-icons">highlight</span>
                        <span className="tab-label">Highlights</span>
                        {exampleHighlights.length > 0 && <span className="tab-count">{exampleHighlights.length}</span>}
                    </button>
                </div>
            </div>
            
            {activeTab === 'document' && (
                <>
                    <div className="chat-history" ref={chatHistoryRef}>
                        {messages.map((message, index) => (
                            <div 
                                key={index} 
                                className={`message-container ${message.type === 'user' ? 'user-container' : 'assistant-container'}`}
                                ref={index === messages.length - 1 ? lastMessageRef : null}
                            >
                                <div className={`message ${message.type === 'user' ? 'user-message' : 'assistant-message'}`}>
                                    {message.isLoading ? (
                                        <LoadingIndicator />
                                    ) : (
                                        <div dangerouslySetInnerHTML={{ __html: formatMessage(message.text) }} />
                                    )}
                                </div>
                            </div>
                        ))}
                        <div className="scroll-anchor" ref={scrollAnchorRef}></div>
                    </div>
                    
                    <div className="chat-input">
                        <div className="chat-input-container">
                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Type your message here..."
                                disabled={isLoading || isStreaming}
                            />
                            {isStreaming ? (
                                <button
                                    onClick={handleStopStreaming}
                                    aria-label="Stop generating"
                                >
                                    <i className="material-icons">stop</i>
                                </button>
                            ) : (
                                <button
                                    onClick={handleSend}
                                    disabled={isLoading || !input.trim()}
                                    aria-label="Send message"
                                >
                                    <i className="material-icons">send</i>
                                </button>
                            )}
                        </div>
                    </div>
                </>
            )}
            
            {(activeTab === 'notes' || activeTab === 'highlights') && renderTabContent()}
        </div>
    );
}
