import React from 'react';
import '../css/NotesPanel.css';

export function NotesPanel({ notes, onNoteClick, onDeleteNote }) {
    return (
        <div className="notes-panel">
            <div className="notes-header">
                <h3>Notes</h3>
            </div>
            <div className="notes-list">
                {notes.length === 0 ? (
                    <div className="no-notes-message">
                        No notes yet. Highlight text and add notes from the chat panel.
                    </div>
                ) : (
                    notes.map((note, index) => (
                        <div
                            key={index}
                            className="note-item"
                        >
                            <div className="note-content" onClick={() => onNoteClick(note)}>
                                <div className="note-text">{note.note}</div>
                                <div className="note-meta">
                                    Page {note.page_number}
                                    <span className="note-time">
                                        {new Date(note.created_at).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                            <button
                                className="delete-note"
                                onClick={() => onDeleteNote(index)}
                            >
                                <span className="material-icons">delete</span>
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
} 