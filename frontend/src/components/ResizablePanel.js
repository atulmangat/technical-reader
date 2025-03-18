import React, { useCallback, useEffect, useRef } from 'react';
import '../css/ResizablePanel.css';

export function ResizablePanel({ children, width, minWidth, maxWidth, onResize, position }) {
    const panelRef = useRef(null);
    const resizerRef = useRef(null);
    const isResizing = useRef(false);
    const startX = useRef(0);
    const startWidth = useRef(0);

    const startResizing = useCallback((e) => {
        // If this is the left panel (TOC) and it's collapsed (width is 48px), don't allow resizing
        if (position === 'left' && width === 48) {
            return;
        }
        
        isResizing.current = true;
        startX.current = e.clientX;
        startWidth.current = panelRef.current.offsetWidth;
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', stopResizing);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }, [position, width]);

    const handleMouseMove = useCallback((e) => {
        if (!isResizing.current) return;

        const delta = position === 'left'
            ? e.clientX - startX.current
            : startX.current - e.clientX;

        const newWidth = Math.min(Math.max(startWidth.current + delta, minWidth), maxWidth);
        onResize(newWidth);
    }, [minWidth, maxWidth, onResize, position]);

    const stopResizing = useCallback(() => {
        isResizing.current = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', stopResizing);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    }, [handleMouseMove]);

    useEffect(() => {
        const resizer = resizerRef.current;
        resizer.addEventListener('mousedown', startResizing);
        return () => {
            resizer.removeEventListener('mousedown', startResizing);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', stopResizing);
        };
    }, [startResizing, handleMouseMove, stopResizing]);

    return (
        <div
            ref={panelRef}
            className={`resizable-panel ${position} ${width === 48 && position === 'left' ? 'collapsed' : ''}`}
            style={{ width: `${width}px` }}
        >
            {children}
            <div
                ref={resizerRef}
                className={`resizer ${position}`}
            />
        </div>
    );
}
