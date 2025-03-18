import React, { useState, useEffect, useRef, useCallback } from "react";
import { ragAPI } from '../services/api';
import '../css/ChatWindow.css';
import { marked } from 'marked'; // Import marked for markdown rendering
import { useAuth } from '../context/AuthContext'; // Import useAuth hook
import { useNavigate } from 'react-router-dom'; // Import useNavigate for navigation

export function ChatWindow({ initialContext, onAddNote, currentSelection, pdfId, currentPage }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [useTools, setUseTools] = useState(true); // Default to using tools
    const [detailedResponse, setDetailedResponse] = useState(false); // New state for detailed response toggle
    const [modeJustSwitched, setModeJustSwitched] = useState(false);
    const [showProfileMenu, setShowProfileMenu] = useState(false); // State for profile menu
    const chatHistoryRef = useRef(null);
    const [streamController, setStreamController] = useState(null);
    const lastMessageRef = useRef(null); // Reference to the last message for scrolling
    const hasManuallyScrolled = useRef(false);
    // Track if we're receiving the first streaming response
    const isFirstStreamingResponse = useRef(false);
    const { user, logout } = useAuth(); // Get user and logout function from auth context
    const navigate = useNavigate(); // Initialize navigation

    // User profile helper functions (similar to Navbar component)
    const getDisplayName = () => {
        // Check for username in all possible locations
        if (user?.username) return user.username;
        if (user?.user?.username) return user.user.username;
        
        // If no username, try to extract from email
        if (user?.email) return user.email.split('@')[0];
        if (user?.user?.email) return user.user.email.split('@')[0];
        
        return 'User';
    };
    
    const getEmail = () => {
        if (user?.email) return user.email;
        if (user?.user?.email) return user.user.email;
        return 'No email available';
    };
    
    const getAvatarUrl = () => {
        return user?.avatar_url || user?.user?.avatar_url;
    };

    const handleLogout = () => {
        logout(navigate);
    };

    const toggleProfileMenu = () => {
        setShowProfileMenu(!showProfileMenu);
    };

    // Navigate to profile page
    const goToProfile = () => {
        navigate('/profile');
        setShowProfileMenu(false);
    };

    // Close profile menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showProfileMenu && 
                event.target.closest('.profile-dropdown') === null) {
                setShowProfileMenu(false);
            }
        };
        
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [showProfileMenu]);

    // Initialize chat with welcome message
    const initializeChat = useCallback(() => {
        return [{
            type: 'assistant',
            text: useTools 
                ? 'How can I help you with this document?' 
                : 'How can I help you today?',
            timestamp: new Date().toISOString(),
            isLoading: false
        }];
    }, [useTools]);

    // Set initial message
    useEffect(() => {
        setMessages(initializeChat());
    }, [initializeChat]);

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

    // Handle mode switching
    const handleModeSwitch = (useToolsValue) => {
        if (useTools !== useToolsValue) {
            setUseTools(useToolsValue);
            // Reset chat when switching modes
            setMessages(initializeChat());
            // Set the flag to show mode info
            setModeJustSwitched(true);
            // Auto-hide the info after 30 seconds
            setTimeout(() => setModeJustSwitched(false), 30000);
        }
    };

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
        </div>
    );

    const StreamingIndicator = () => (
        <div className="streaming-indicator">
            <div className="streaming-pulse"></div>
        </div>
    );

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
                use_tools: useTools,
                detailed_response: detailedResponse,
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
        if (message.type === 'selection') {
            return null;
        }

        // Handle code blocks and tool results in messages
        let formattedText = message.text;
        
        // Check if the message contains code blocks
        if (message.text && message.text.includes('```')) {
            const parts = message.text.split(/(```(?:.*?)\n[\s\S]*?```)/g);
            
            return (
                <div className={`message ${message.type}-message`}>
                    {parts.map((part, index) => {
                        if (part.startsWith('```') && part.endsWith('```')) {
                            // Extract language and code
                            const match = part.match(/```(.*?)\n([\s\S]*?)```/);
                            if (match) {
                                const [, language, code] = match;
                                return (
                                    <div key={index} className="code-block">
                                        {language && <div className="code-language">{language}</div>}
                                        <pre>{code}</pre>
                                    </div>
                                );
                            }
                        }
                        // Apply markdown parsing for non-code parts
                        return <div key={index} dangerouslySetInnerHTML={{ __html: marked(part, { breaks: true }) }} />;
                    })}
                </div>
            );
        }
        
        // If no code blocks, apply markdown to the entire text
        return (
            <div 
                className={`message ${message.type}-message`}
                dangerouslySetInnerHTML={{ __html: marked(formattedText || '', { breaks: true }) }}
            />
        );
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

    return (
        <div className="chat-window">
            <div className="chat-header">
                <div className="chat-header-main">
                    <h3>Chat Assistant</h3>
                    
                    <div className="chat-header-right">
                        <div className="profile-section">
                            <span className="username">{getDisplayName()}</span>
                            <div className="profile-dropdown">
                                <button 
                                    className="profile-button" 
                                    onClick={toggleProfileMenu}
                                    aria-expanded={showProfileMenu}
                                    title="Profile Menu"
                                >
                                    <div className="avatar-container">
                                        {getAvatarUrl() ? (
                                            <img 
                                                src={getAvatarUrl()} 
                                                alt={`${getDisplayName()}'s avatar`} 
                                                className="avatar-image" 
                                            />
                                        ) : (
                                            <div className="avatar-placeholder">
                                                {getDisplayName().charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                </button>
                                
                                {showProfileMenu && (
                                    <div className="dropdown-menu">
                                        <div className="dropdown-header">
                                            <div className="dropdown-avatar">
                                                {getAvatarUrl() ? (
                                                    <img 
                                                        src={getAvatarUrl()} 
                                                        alt={`${getDisplayName()}'s avatar`} 
                                                        className="dropdown-avatar-image" 
                                                    />
                                                ) : (
                                                    <div className="dropdown-avatar-placeholder">
                                                        {getDisplayName().charAt(0).toUpperCase()}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="dropdown-user-info">
                                                <div className="dropdown-username">{getDisplayName()}</div>
                                                <div className="dropdown-email">{getEmail()}</div>
                                            </div>
                                        </div>
                                        <div className="dropdown-content">
                                            <button onClick={goToProfile} className="dropdown-item">
                                                Profile
                                            </button>
                                            <button 
                                                className="dropdown-item" 
                                                onClick={goToProfile}
                                            >
                                                Change Avatar
                                            </button>
                                            <button 
                                                className="dropdown-item logout-button" 
                                                onClick={handleLogout}
                                            >
                                                Logout
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="chat-mode-switcher">
                    <div className="radio-group">
                        <label className={`radio-label ${useTools ? 'active' : ''}`}>
                            <input
                                type="radio"
                                name="chat-mode"
                                checked={useTools}
                                onChange={() => handleModeSwitch(true)}
                            />
                            <span className="radio-text">Document Q&A</span>
                        </label>
                        <label className={`radio-label ${!useTools ? 'active' : ''}`}>
                            <input
                                type="radio"
                                name="chat-mode"
                                checked={!useTools}
                                onChange={() => handleModeSwitch(false)}
                            />
                            <span className="radio-text">General Chat</span>
                        </label>
                    </div>
                </div>
                
                {modeJustSwitched && (
                    <div className="mode-info">
                        <div className={`mode-info-content ${useTools ? 'tool-mode' : 'regular-mode'}`}>
                            <div className="mode-icon">
                                {useTools ? '📚' : '💬'}
                            </div>
                            <div className="mode-details">
                                <h4>{useTools ? 'Document Q&A Mode' : 'General Chat Mode'}</h4>
                                <p>
                                    {useTools 
                                        ? 'Ask questions about the document content. The AI will use the document to provide accurate answers.'
                                        : 'Chat with the AI assistant about any topic. This mode doesn\'t reference the document.'}
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <div className="chat-history" ref={chatHistoryRef}>
                {messages.map((message, index) => (
                    <div 
                        key={index} 
                        className="message-container"
                        ref={index === messages.length - 1 ? lastMessageRef : null}
                    >
                        {message.isLoading ? <LoadingIndicator /> : 
                         message.isStreaming ? (
                            <>
                                {formatMessage(message)}
                                <StreamingIndicator />
                            </>
                         ) : 
                         formatMessage(message)}
                    </div>
                ))}
            </div>
            <div className="chat-input">
                <div className="chat-input-container">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={useTools ? "Ask a question about this document..." : "Chat with AI..."}
                        disabled={isLoading}
                    />
                    <div className="chat-input-options">
                        <div className="response-type-toggle">
                            <label className="toggle-switch" title="Toggle between brief and detailed responses">
                                <input
                                    type="checkbox"
                                    checked={detailedResponse}
                                    onChange={() => setDetailedResponse(!detailedResponse)}
                                />
                                <span className="toggle-slider"></span>
                                <span className="toggle-label">{detailedResponse ? "Detailed" : "Brief"} Response</span>
                            </label>
                        </div>
                        
                        <div className="button-container">
                            {isStreaming ? (
                                <button onClick={handleStopStreaming} className="stop-button">
                                    Stop
                                </button>
                            ) : (
                                <button onClick={handleSend} disabled={isLoading || !input.trim()}>
                                    Send
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
