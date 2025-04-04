import React, { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import { ragAPI, userAPI } from '../services/api';
import '../css/ChatWindow.css';
import { marked } from 'marked'; // Import marked for markdown rendering
import { useNavigate } from 'react-router-dom'; // Import useNavigate for navigation
import { Navbar } from './Navbar'; // Import Navbar component

const ChatWindow = forwardRef(({ initialContext, onAddNote, currentSelection, pdfId, currentPage }, ref) => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [activeTab, setActiveTab] = useState('document'); // Keep document as the only tab
    const [showTabInfo, setShowTabInfo] = useState(false); // State to track whether to show tab info
    const [summaryQuestions, setSummaryQuestions] = useState([]); // State for summary questions
    const [showSummaryTool, setShowSummaryTool] = useState(true); // State to control summary tool visibility
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

    // Expose functions to parent component through ref
    useImperativeHandle(ref, () => ({
        explainSelection: (selectedText) => {
            if (!selectedText) return;
            
            // Cancel any existing stream before starting a new one
            if (streamController) {
                handleStopStreaming();
            }
            
            // Format the selected text (limit to 100 characters with ellipsis if longer)
            const formattedText = selectedText.length > 100 
                ? `${selectedText.substring(0, 100)}...` 
                : selectedText;
                
            // Add selected text as user message with "Explain:" prefix
            // Remove the page number from the display message
            const userMessage = {
                type: 'user',
                text: `## Explain:\n> ${formattedText}`,
                timestamp: new Date().toISOString(),
                isExplain: true // Mark as an explain request
            };
            
            // Add loader message for the AI response
            const assistantMessage = {
                type: 'assistant',
                text: '',
                timestamp: new Date().toISOString(),
                isLoading: true,
                isStreaming: false,
                isExplainResponse: true // Mark as an explain response
            };
            
            // Add messages to chat
            setMessages(prev => [...prev, userMessage, assistantMessage]);
            
            // Set loading state
            setIsLoading(true);
            setIsStreaming(false);
            
            // Call the API with the selected text
            handleExplainRequest(selectedText);
        }
    }));
    
    // Function to handle explain requests
    const handleExplainRequest = async (selectedText) => {
        try {
            // Cancel any existing stream again (as a safety measure)
            if (streamController) {
                streamController.cancel();
                setStreamController(null);
            }
            
            // Reset manual scroll tracking
            hasManuallyScrolled.current = false;
            isFirstStreamingResponse.current = true;
            
            // Get all messages for conversation history
            const historyMessages = [...messages];
            
            // Format conversation history for API
            const conversationHistory = historyMessages
                .filter(msg => msg.type === 'user' || msg.type === 'assistant')
                .map(msg => ({
                    role: msg.type === 'user' ? 'user' : 'assistant',
                    content: msg.text
                }));
            
            console.log('Starting explain streaming request...');
            console.log('Current page:', currentPage);
            
            // Store response text as it builds up
            let responseText = '';
            let hasReceivedFirstChunk = false;
            
            // Create the explain API request
            const apiRequest = ragAPI.explainText(pdfId, selectedText, {
                conversation_history: conversationHistory,
                current_page: currentPage
            });
            
            // Start the streaming request
            const controller = apiRequest.stream(
                // onMessage handler - called for each chunk
                (chunk) => {
                    console.log('Received explanation chunk:', chunk);
                    
                    // Mark as streaming after first chunk
                    if (!hasReceivedFirstChunk) {
                        hasReceivedFirstChunk = true;
                        setIsStreaming(true);
                        
                        // Update the loading message to show it's streaming
                        setMessages(prev => {
                            const updatedMessages = [...prev];
                            const lastMessage = updatedMessages[updatedMessages.length - 1];
                            if (lastMessage && lastMessage.type === 'assistant' && lastMessage.isLoading) {
                                lastMessage.isLoading = false;
                                lastMessage.isStreaming = true;
                            }
                            return updatedMessages;
                        });
                    }
                    
                    // Append new chunk to the response
                    responseText += chunk;
                    
                    // Update the message with the current response
                    setMessages(prev => {
                        const updatedMessages = [...prev];
                        const lastMessage = updatedMessages[updatedMessages.length - 1];
                        if (lastMessage && lastMessage.type === 'assistant') {
                            lastMessage.text = responseText;
                        }
                        return updatedMessages;
                    });
                },
                // onError handler
                (error) => {
                    console.error('Streaming error:', error);
                    
                    // Update the loading message to show the error
                    setMessages(prev => {
                        const updatedMessages = [...prev];
                        const lastMessage = updatedMessages[updatedMessages.length - 1];
                        if (lastMessage && lastMessage.type === 'assistant' && (lastMessage.isLoading || lastMessage.isStreaming)) {
                            lastMessage.isLoading = false;
                            lastMessage.isStreaming = false;
                            lastMessage.text = "Sorry, there was an error generating an explanation. Please try again.";
                        }
                        return updatedMessages;
                    });
                    
                    // Reset states
                    setIsLoading(false);
                    setIsStreaming(false);
                    setStreamController(null);
                },
                // onComplete handler
                () => {
                    console.log('Streaming complete');
                    
                    // Mark the streaming as complete
                    setMessages(prev => {
                        const updatedMessages = [...prev];
                        const lastMessage = updatedMessages[updatedMessages.length - 1];
                        if (lastMessage && lastMessage.type === 'assistant') {
                            lastMessage.isStreaming = false;
                        }
                        return updatedMessages;
                    });
                    
                    // Reset states
                    setIsLoading(false);
                    setIsStreaming(false);
                    setStreamController(null);
                }
            );
            
            // Store the controller for potential cancellation
            setStreamController(controller);
        } catch (error) {
            console.error('Error handling explain request:', error);
            // Update the message to show the error
            setMessages(prev => {
                const updatedMessages = [...prev];
                const lastMessage = updatedMessages[updatedMessages.length - 1];
                if (lastMessage && lastMessage.type === 'assistant' && lastMessage.isLoading) {
                    lastMessage.isLoading = false;
                    lastMessage.text = "Sorry, there was an error generating an explanation. Please try again.";
                }
                return updatedMessages;
            });
            
            // Reset states
            setIsLoading(false);
            setStreamController(null);
        }
    };

    // Function to fetch summary and generate questions
    const fetchSummaryQuestions = useCallback(async () => {
        if (!pdfId) return;
        
        try {
            // Use the summary tool to get document summary
            const response = await ragAPI.query(pdfId, "Summarize this document", {
                use_tools: true,
                tool_preferences: ["summary"]
            });
            
            if (response && response.data && response.data.response) {
                // Generate questions based on the summary
                const summaryResponse = await ragAPI.query(pdfId, 
                    "Based on the document summary, generate 3 specific questions a user might want to ask about this document. Format them as a numbered list.", 
                    { conversation_history: [
                        { role: "assistant", content: response.data.response }
                    ]}
                );
                
                if (summaryResponse && summaryResponse.data && summaryResponse.data.response) {
                    // Parse the numbered list of questions
                    const questionText = summaryResponse.data.response;
                    const questionRegex = /\d+\.\s+(.+?)(?=\n\d+\.|\n\n|$)/gs;
                    const questions = [];
                    let match;
                    
                    while ((match = questionRegex.exec(questionText)) !== null) {
                        if (match[1].trim()) {
                            questions.push(match[1].trim());
                        }
                    }
                    
                    setSummaryQuestions(questions.length > 0 ? questions : [
                        "Summarize this guide",
                        "What types of problems can machine learning effectively address?",
                        "Why is Python considered a suitable language for machine learning?"
                    ]);
                }
            }
        } catch (error) {
            console.error('Error fetching summary questions:', error);
            // Set default questions if error occurs
            setSummaryQuestions([
                "Summarize this guide",
                "What types of problems can machine learning effectively address?",
                "Why is Python considered a suitable language for machine learning?"
            ]);
        }
    }, [pdfId]);

    // Initialize chat with welcome message
    const initializeChat = useCallback(async () => {
        // If there's no PDF id, return a default message
        if (!pdfId) {
            return [{
                type: 'assistant',
                text: 'How can I help you with this document?',
                timestamp: new Date().toISOString(),
                isLoading: false
            }];
        }

        // Add a loading message while we fetch the welcome chat
        const loadingMessage = {
            type: 'assistant',
            text: '',
            timestamp: new Date().toISOString(),
            isLoading: true
        };

        setMessages([loadingMessage]);

        try {
            // Create API request with welcome_chat flag set to true
            const welcomeQuery = "Welcome to this document";
            const apiRequest = ragAPI.query(pdfId, welcomeQuery, {
                welcome_chat: true, // Set the welcome_chat flag
                use_tools: false // Set to false so the welcome_chat flag is processed
            });

            const response = await apiRequest.regular();
            
            if (response && response.data && response.data.response) {
                return [{
                    type: 'assistant',
                    text: response.data.response,
                    timestamp: new Date().toISOString(),
                    isLoading: false
                }];
            }
        } catch (error) {
            console.error('Error fetching welcome message:', error);
        }

        // Fallback to default message if API call fails
        return [{
            type: 'assistant',
            text: 'How can I help you with this document?',
            timestamp: new Date().toISOString(),
            isLoading: false
        }];
    }, [pdfId]);

    // Set initial message AFTER preferences have loaded
    useEffect(() => {
        if (messages.length === 0) {
            initializeChat().then(initialMessages => {
                setMessages(initialMessages);
                fetchSummaryQuestions(); // Fetch summary questions when chat initializes
            });
        }
    }, [initializeChat, messages.length, fetchSummaryQuestions]);

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

    // Handle tab switching - keeping this function even though we only have one tab now
    const handleTabSwitch = useCallback((tabName) => {
        setActiveTab(tabName);
        
        // Focus the input after switching to document tab
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

    // Function to handle question selection
    const handleQuestionClick = (question) => {
        setInput(question);
        setShowSummaryTool(false); // Hide the summary tool after question selection
    };
    
    // Handle question submission
    const submitQuestion = (question) => {
        setInput(question);
        handleSend(question);
        setShowSummaryTool(false); // Hide the summary tool after question submission
    };
    
    // Modified handleSend to optionally accept a custom message
    const handleSend = async (customMessage) => {
        const messageText = customMessage || input;
        if (!messageText.trim()) return;

        // Cancel any existing stream (works for both regular chat and explain requests)
        if (streamController) {
            streamController.cancel();
            setStreamController(null);
        }

        // Reset manual scroll tracking and set first streaming flag
        hasManuallyScrolled.current = false;
        isFirstStreamingResponse.current = true;

        const userMessage = {
            type: 'user',
            text: messageText,
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
            const apiRequest = ragAPI.query(pdfId, messageText, {
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
        
        // Format page links only (not regular page numbers)
        formattedText = formattedText.replace(/PAGE (\d+)/g, (match, pageNum) => {
            return renderPageLink(pageNum);
        });
        
        // Don't convert "Page X" format to badges
        
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

    return (
        <div className="chat-window" ref={chatWindowRef}>
            <div className="chat-header">
                <div className="chat-header-main">
                    <div className="assistant-title">
                        <span className="material-icons">psychology</span>
                        <div>
                            <h2>Document Assistant</h2>
                            <span>Powered by AI</span>
                        </div>
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
            </div>
            
            <div className="chat-history" ref={chatHistoryRef}>
                {messages.map((message, index) => (
                    <div 
                        key={index} 
                        className={`message-container ${message.type === 'user' ? 'user-container' : 'assistant-container'}`}
                        ref={index === messages.length - 1 ? lastMessageRef : null}
                    >
                        <div className={`message ${message.type === 'user' ? 'user-message' : 'assistant-message'} 
                            ${message.isExplain ? 'explanation-request' : ''} 
                            ${message.isExplainResponse ? 'explanation-response' : ''}`}>
                            {message.isLoading ? (
                                <LoadingIndicator />
                            ) : (
                                <div dangerouslySetInnerHTML={{ __html: formatMessage(message.text) }} />
                            )}
                        </div>
                    </div>
                ))}
                <div className="scroll-anchor" ref={scrollAnchorRef}></div>
                
                {/* Summary tool with generated questions */}
                {showSummaryTool && summaryQuestions.length > 0 && !isStreaming && !isLoading && (
                    <div className="summary-tool">
                        <div className="summary-tool-header">
                            <span className="material-icons">list_alt</span>
                            <h3>Summarize this guide</h3>
                        </div>
                        <div className="summary-questions">
                            {summaryQuestions.map((question, index) => (
                                <div 
                                    key={index}
                                    className="summary-question"
                                    onClick={() => submitQuestion(question)}
                                >
                                    <span className="question-icon material-icons">
                                        {index === 0 ? 'summarize' : 'help_outline'}
                                    </span>
                                    <p>{question}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            
            <div className="chat-input">
                <div className="chat-input-container">
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask questions about this document..."
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
                            onClick={() => handleSend()}
                            disabled={isLoading || !input.trim()}
                            aria-label="Send message"
                        >
                            <i className="material-icons">send</i>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
});

export default ChatWindow;
