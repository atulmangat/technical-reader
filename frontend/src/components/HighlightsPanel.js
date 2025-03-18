import React from 'react';
import '../css/HighlightsPanel.css';

export function HighlightsPanel({ highlights, onHighlightClick, onDeleteHighlight }) {
    return (
        <div className="highlights-panel">
            <div className="highlights-header">
                <h3>Highlights</h3>
            </div>
            <div className="highlights-list">
                {highlights.map((highlight, index) => (
                    <div
                        key={index}
                        className="highlight-item"
                        style={{ borderLeft: `4px solid ${highlight.color}` }}
                    >
                        <div className="highlight-content" onClick={() => onHighlightClick(highlight)}>
                            <div className="highlight-text">{highlight.text}</div>
                            <div className="highlight-note">{highlight.note}</div>
                            <div className="highlight-meta">
                                Page {highlight.page_number}
                                <span className="highlight-time">
                                    {new Date(highlight.timestamp).toLocaleString()}
                                </span>
                            </div>
                        </div>
                        <button
                            className="delete-highlight"
                            onClick={() => onDeleteHighlight(index)}
                        >
                            <span className="material-icons">delete</span>
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
