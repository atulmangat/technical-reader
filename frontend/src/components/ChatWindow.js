import React, { useState, useEffect, useRef } from "react";
import '../css/ChatWindow.css';

export function ChatWindow({ initialContext, onAddNote, currentSelection }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const chatHistoryRef = useRef(null);

    useEffect(() => {
        setMessages([{
            type: 'assistant',
            text: 'How can I help you today?',
            timestamp: new Date().toISOString(),
            isLoading: false
        }]);
    }, []);

    useEffect(() => {
        if (currentSelection) {
            setMessages(prev => [...prev, {
                type: 'selection',
                text: currentSelection.text,
                timestamp: new Date().toISOString()
            }]);
        }
    }, [currentSelection]);

    const scrollToBottom = () => {
        if (chatHistoryRef.current) {
            requestAnimationFrame(() => {
                chatHistoryRef.current.scrollTo({
                    top: chatHistoryRef.current.scrollHeight,
                    behavior: 'smooth'
                });
            });
        }
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const callChatAPI = async (question, context, history, onChunk) => {
        try {
            const response = await fetch('http://localhost:5000/api/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    question,
                    context,
                    history: history.map(msg => ({
                        role: msg.type === 'user' ? 'user' : 'assistant',
                        content: msg.text
                    })),
                    stream: true
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to get response');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const text = decoder.decode(value);
                const lines = text.split('\n');

                for (const line of lines) {
                    if (!line.trim() || !line.startsWith('data: ')) continue;
                    
                    const data = line.slice(6);
                    if (data === '[DONE]') break;

                    try {
                        const parsed = JSON.parse(data);
                        const content = parsed.choices?.[0]?.delta?.content;
                        if (content) {
                            const formattedContent = content.replace(/\\n/g, '\n');
                            onChunk(formattedContent);
                        }
                    } catch (e) {
                        if (data.includes('content')) {
                            const match = data.match(/"content"\s*:\s*"([^"]+)"/);
                            if (match && match[1]) {
                                const formattedContent = match[1].replace(/\\n/g, '\n');
                                onChunk(formattedContent);
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error('API call error:', error);
            throw error;
        }
    };

    const LoadingIndicator = () => (
        <div className="loading-indicator">
            <div className="typing-dots">
                <span></span>
                <span></span>
                <span></span>
            </div>
        </div>
    );

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMessage = {
            type: 'user',
            text: input,
            timestamp: new Date().toISOString()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput("");
        setIsLoading(true);

        try {
            const assistantMessage = {
                type: 'assistant',
                text: '...',
                timestamp: new Date().toISOString(),
                isLoading: true
            };
            
            // Get chat history excluding the initial welcome message and selection messages
            const chatHistory = messages.filter(msg => 
                msg.type === 'user' || (msg.type === 'assistant' && msg.text !== 'How can I help you today?')
            );
            
            setMessages(prev => [...prev, assistantMessage]);
            
            let fullResponse = '';
            
            await callChatAPI(
                input, 
                currentSelection?.text, 
                chatHistory,
                (chunk) => {
                    fullResponse += chunk;
                    setMessages(prev => {
                        const newMessages = [...prev];
                        const lastMessage = newMessages[newMessages.length - 1];
                        if (lastMessage.type === 'assistant') {
                            return [
                                ...prev.slice(0, -1),
                                {
                                    ...lastMessage,
                                    text: fullResponse,
                                    isLoading: false
                                }
                            ];
                        }
                        return prev;
                    });
                }
            );
        } catch (error) {
            setMessages(prev => [
                ...prev.slice(0, -1),
                {
                    type: 'error',
                    text: error.message || 'Failed to get response',
                    timestamp: new Date().toISOString()
                }
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="chat-window">
            <div className="chat-header">
                <h3>AI Assistant</h3>
            </div>
            
            <div className="chat-history" ref={chatHistoryRef}>
                {messages.map((msg, index) => (
                    <div 
                        key={index} 
                        className={`message ${msg.type}`}
                        ref={index === messages.length - 1 ? scrollToBottom : null}
                    >
                        {msg.type === 'selection' && <div className="selection-label">Selected Text:</div>}
                        <div className="message-content">
                            {msg.isLoading ? (
                                <div className="loading-dots">
                                    <span>.</span>
                                    <span>.</span>
                                    <span>.</span>
                                </div>
                            ) : (
                                msg.text
                            )}
                        </div>
                        <div className="message-timestamp">
                            {new Date(msg.timestamp).toLocaleTimeString()}
                        </div>
                    </div>
                ))}
            </div>

            <div className="chat-input">
                <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask a question about the selected text..."
                    onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                        }
                    }}
                    disabled={isLoading}
                />
                <button onClick={handleSend} disabled={isLoading}>
                    {isLoading ? <LoadingIndicator /> : <span className="material-icons">send</span>}
                </button>
            </div>
        </div>
    );
} 