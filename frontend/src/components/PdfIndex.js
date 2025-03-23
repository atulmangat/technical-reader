import React, { useState, useEffect, useRef } from 'react';
import '../css/PdfIndex.css';

export function PdfIndex({ currentPage, totalPages, onPageSelect, pdf, onToggle }) {
    const [outline, setOutline] = useState([]);
    const [expandedItems, setExpandedItems] = useState(new Set());
    const [activeItem, setActiveItem] = useState(null);
    const [isExpanded, setIsExpanded] = useState(false);
    const indexRef = useRef(null);

    useEffect(() => {
        if (onToggle) {
            onToggle(isExpanded);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);  // Empty dependency array ensures this runs only once on mount

    useEffect(() => {
        const loadOutline = async () => {
            if (!pdf) return;
            try {
                const outline = await pdf.getOutline();
                if (outline && outline.length > 0) {
                    setOutline(outline);
                    // Expand first level by default
                    const firstLevelItems = new Set(outline.map((_, index) => `0-${index}`));
                    setExpandedItems(firstLevelItems);
                }
            } catch (error) {
                console.error('Error loading outline:', error);
            }
        };

        loadOutline();
    }, [pdf]);

    // Add event listener to detect clicks outside when expanded
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (isExpanded && indexRef.current && !indexRef.current.contains(event.target)) {
                toggleTocExpanded();
            }
        };

        if (isExpanded) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isExpanded]);

    const toggleExpand = (itemId) => {
        setExpandedItems(prev => {
            const newSet = new Set(prev);
            if (newSet.has(itemId)) {
                newSet.delete(itemId);
            } else {
                newSet.add(itemId);
            }
            return newSet;
        });
    };

    const toggleTocExpanded = () => {
        const newExpandedState = !isExpanded;
        setIsExpanded(newExpandedState);
        
        if (onToggle) {
            onToggle(newExpandedState);
        }
    };

    const handleItemClick = async (item, itemId) => {
        try {
            if (item.dest) {
                // Get the destination array
                const destination = await pdf.getDestination(item.dest);
                if (destination) {
                    // Get the reference to the destination page
                    const pageRef = destination[0];
                    // Get the page number
                    const pageNumber = await pdf.getPageIndex(pageRef) + 1;

                    // Get the page
                    const page = await pdf.getPage(pageNumber);
                    const viewport = page.getViewport({ scale: 1.0 });

                    // Parse the destination array to get the y coordinate
                    // destination[3] contains the y coordinate in PDF user space
                    let yCoordinate = destination[3];
                    if (Array.isArray(destination) && destination.length >= 4) {
                        // Convert PDF coordinates to viewport coordinates
                        // PDF coordinates start from bottom, viewport from top
                        yCoordinate = viewport.height - destination[3];
                    }

                    // Update the current page and scroll position
                    onPageSelect(pageNumber, {
                        x: 0,
                        y: yCoordinate
                    });

                    setActiveItem(itemId);
                }
            } else if (item.url) {
                // Handle external URLs if they exist
                window.open(item.url, '_blank');
            }
        } catch (error) {
            console.error('Error navigating to destination:', error);
        }
    };

    const renderOutlineItem = (item, level = 0, index) => {
        const itemId = `${level}-${index}`;
        const hasChildren = item.items && item.items.length > 0;
        const isExpanded = expandedItems.has(itemId);
        const isActive = itemId === activeItem;

        return (
            <div key={itemId} className="outline-item-container">
                <div
                    className={`outline-item ${isActive ? 'active' : ''}`}
                    style={{ paddingLeft: `${level * 16}px` }}
                >
                    {hasChildren && (
                        <button
                            className={`expand-button ${isExpanded ? 'expanded' : ''}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleExpand(itemId);
                            }}
                        >
                            <span className="material-icons">
                                {isExpanded ? 'expand_more' : 'chevron_right'}
                            </span>
                        </button>
                    )}
                    <span
                        className="outline-title"
                        onClick={() => handleItemClick(item, itemId)}
                        title={item.title}
                    >
                        {item.title}
                    </span>
                </div>
                {hasChildren && isExpanded && (
                    <div className="outline-children">
                        {item.items.map((child, childIndex) =>
                            renderOutlineItem(child, level + 1, childIndex)
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div 
            ref={indexRef} 
            className={`pdf-index ${isExpanded ? 'expanded' : 'collapsed'}`}
            onClick={() => {
                if (!isExpanded) {
                    toggleTocExpanded();
                }
            }}
        >
            <div className="index-header">
                <h2>Document Contents</h2>
                <button 
                    className="toggle-toc-button" 
                    onClick={(e) => {
                        e.stopPropagation();
                        toggleTocExpanded();
                    }}
                    title={isExpanded ? "Collapse table of contents" : "Expand table of contents"}
                >
                    <span className="material-icons">
                        {isExpanded ? 'chevron_left' : 'chevron_right'}
                    </span>
                </button>
            </div>
            {!isExpanded && (
                <>
                    <div 
                        className="collapsed-toc-icon" 
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleTocExpanded();
                        }}
                    >
                        <span className="material-icons">menu_book</span>
                    </div>
                    <div 
                        className="vertical-toc-title" 
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleTocExpanded();
                        }}
                    >
                        Document Contents
                    </div>
                </>
            )}
            <div 
                className={`outline-container ${isExpanded ? 'visible' : 'hidden'}`}
                onClick={(e) => {
                    if (isExpanded) {
                        e.stopPropagation(); // Prevent clicks inside from bubbling up and collapsing
                    }
                }}
            >
                {outline.length > 0 ? (
                    outline.map((item, index) => renderOutlineItem(item, 0, index))
                ) : (
                    <div className="no-outline">
                        No document contents available
                    </div>
                )}
            </div>
        </div>
    );
}
