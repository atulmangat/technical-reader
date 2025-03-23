import React, { useState } from 'react';
import '../css/TabbedPanel.css';
import { NotesPanel } from './NotesPanel';
import { HighlightsPanel } from './HighlightsPanel';

export function TabbedPanel({ 
    highlights,
    onHighlightClick,
    onDeleteHighlight,
    notes,
    onNoteClick,
    onDeleteNote
}) {
    const [activeTab, setActiveTab] = useState('notes');

    // Get count of items for each tab
    const getNotesCount = () => notes.length;
    const getHighlightsCount = () => highlights.length;

    return (
        <div className="tabbed-panel">
            <div className="panel-header">
                <div className="tab-header">
                    <button 
                        className={`tab-button ${activeTab === 'notes' ? 'active' : ''}`} 
                        onClick={() => setActiveTab('notes')}
                    >
                        <span className="material-icons">note</span>
                        <span className="tab-label">Notes</span>
                        {getNotesCount() > 0 && <span className="tab-count">{getNotesCount()}</span>}
                    </button>
                    <button 
                        className={`tab-button ${activeTab === 'highlights' ? 'active' : ''}`} 
                        onClick={() => setActiveTab('highlights')}
                    >
                        <span className="material-icons">format_highlight</span>
                        <span className="tab-label">Highlights</span>
                        {getHighlightsCount() > 0 && <span className="tab-count">{getHighlightsCount()}</span>}
                    </button>
                </div>
            </div>
            <div className="tab-content">
                {activeTab === 'notes' && (
                    <NotesPanel
                        notes={notes}
                        onNoteClick={onNoteClick}
                        onDeleteNote={onDeleteNote}
                    />
                )}
                {activeTab === 'highlights' && (
                    <HighlightsPanel
                        highlights={highlights}
                        onHighlightClick={onHighlightClick}
                        onDeleteHighlight={onDeleteHighlight}
                    />
                )}
            </div>
        </div>
    );
} 