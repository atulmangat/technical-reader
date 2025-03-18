import React, { useEffect, useRef, useState, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import "pdfjs-dist/web/pdf_viewer.css";
import { useParams, useNavigate } from 'react-router-dom';
import { PdfIndex } from './PdfIndex';
import { ResizablePanel } from './ResizablePanel';
import { ChatWindow } from './ChatWindow';
import { HighlightsPanel } from './HighlightsPanel';
import { Navbar } from './Navbar';
import { pdfAPI, highlightsAPI } from '../services/api';

// Set worker path correctly
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// Add these zoom-related constants at the top of the file
const ZOOM_LEVELS = [0.5, 0.75, 1.0, 1.25, 1.75, 2.0, 2.5, 3.0];
const DEFAULT_ZOOM_INDEX = 4; // 1.75 is the default zoom level

export function PdfViewer() {
    const { id } = useParams();
    const navigate = useNavigate();
    const viewerRef = useRef(null);
    const textLayerRef = useRef(null);
    const [pdf, setPdf] = useState(null);
    const [error, setError] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [scale, setScale] = useState(1.75);
    const [hoveredElement, setHoveredElement] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [highlights, setHighlights] = useState([]);
    const [indexWidth, setIndexWidth] = useState(48);
    const [chatWidth, setChatWidth] = useState(600);
    const [selectedText, setSelectedText] = useState('');
    const [currentSelection, setCurrentSelection] = useState(null);
    const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX);
    const [selectionStart, setSelectionStart] = useState(null);
    const [pageScrollPosition, setPageScrollPosition] = useState(null);
    const [pageTransition, setPageTransition] = useState('page-current');
    const [transitionDirection, setTransitionDirection] = useState('next');
    const [scrollPosition, setScrollPosition] = useState(null);
    const [selectedColor, setSelectedColor] = useState('#ffeb3b');
    const [tocCollapsed, setTocCollapsed] = useState(true);
    const [previousIndexWidth, setPreviousIndexWidth] = useState(300);
    const [previousChatWidth, setPreviousChatWidth] = useState(500);

    // First, define handlePageChange
    const handlePageChange = useCallback((newPage, scrollTo = null) => {
        const direction = newPage > currentPage ? 'next' : 'prev';
        setTransitionDirection(direction);

        // Start exit animation
        setPageTransition('page-exit');

        // After small delay, change page and start enter animation
        setTimeout(() => {
            setCurrentPage(newPage);
            setPageTransition('page-enter');

            // Set scroll position if provided
            if (scrollTo) {
                setScrollPosition(scrollTo);
            }

            // After enter animation starts, move to current state
            setTimeout(() => {
                setPageTransition('page-current');
            }, 50);
        }, 150);
    }, [currentPage]);

    // Then define changePage which uses handlePageChange
    const changePage = useCallback((delta) => {
        const newPage = currentPage + delta;
        if (newPage >= 1 && newPage <= totalPages) {
            handlePageChange(newPage);
        }
    }, [currentPage, totalPages, handlePageChange]);

    // Memoize the renderHighlights function
    const renderHighlights = useCallback((highlights, viewport) => {
        if (!viewerRef.current) return;

        const container = viewerRef.current.parentElement;
        const existingHighlights = container.querySelector('.highlight-layer');
        if (existingHighlights) {
            container.removeChild(existingHighlights);
        }

        const highlightLayer = document.createElement('div');
        highlightLayer.className = 'highlight-layer';
        highlightLayer.style.position = 'absolute';
        highlightLayer.style.top = `${viewerRef.current.offsetTop}px`;
        highlightLayer.style.left = `${viewerRef.current.offsetLeft}px`;

        highlights.forEach(highlight => {
            if (highlight.page === currentPage) {
                const div = document.createElement('div');
                div.className = 'highlight';
                div.style.position = 'absolute';
                div.style.backgroundColor = 'rgba(255, 255, 0, 0.3)';
                div.style.left = `${highlight.position.left}px`;
                div.style.top = `${highlight.position.top}px`;
                div.style.width = `${highlight.position.width}px`;
                div.style.height = `${highlight.position.height}px`;
                div.title = highlight.note;
                highlightLayer.appendChild(div);
            }
        });

        container.appendChild(highlightLayer);
    }, [currentPage]);

    // Add dependencies to useEffect
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowRight') {
                changePage(1);
            } else if (e.key === 'ArrowLeft') {
                changePage(-1);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [changePage]);  // Add changePage as dependency

    useEffect(() => {
        const loadPdf = async () => {
            try {
                setIsLoading(true);
                setError(null);

                const response = await pdfAPI.getPdf(id);
                
                if (!response) {
                    throw new Error('Failed to load PDF');
                }

                const blob = await response.data;
                const pdfUrl = URL.createObjectURL(blob);

                const loadingTask = pdfjsLib.getDocument({ url: pdfUrl });
                const pdfDoc = await loadingTask.promise;
                setPdf(pdfDoc);
                setTotalPages(pdfDoc.numPages);
            } catch (err) {
                console.error('Error loading PDF:', err);
                setError(`Error loading PDF: ${err.message}`);
                if (err.response?.status === 401) {
                    navigate('/login');
                }
            } finally {
                setIsLoading(false);
            }
        };

        if (id) {
            loadPdf();
        }
    }, [id, navigate]);

    useEffect(() => {
        if (!pdf || !viewerRef.current || !textLayerRef.current) return;

        let isMounted = true;
        let renderTask = null;

        const renderPage = async () => {
            try {
                setError(null);
                const page = await pdf.getPage(currentPage);
                const viewport = page.getViewport({ scale: 1.0 });
                const canvas = viewerRef.current;
                const textLayer = textLayerRef.current;

                if (!canvas || !textLayer || !isMounted) {
                    return;
                }

                const context = canvas.getContext('2d', { alpha: false });
                if (!context) {
                    throw new Error('Unable to get canvas context');
                }

                // Clear previous content
                context.clearRect(0, 0, canvas.width, canvas.height);

                // Scale the canvas
                canvas.height = viewport.height * scale;
                canvas.width = viewport.width * scale;
                canvas.style.width = `${viewport.width * scale}px`;
                canvas.style.height = `${viewport.height * scale}px`;

                // Scale the context
                context.setTransform(scale, 0, 0, scale, 0, 0);

                const renderContext = {
                    canvasContext: context,
                    viewport: viewport,
                    background: 'rgb(255, 255, 255)',
                };

                // Cancel any previous render task
                if (renderTask) {
                    await renderTask.cancel();
                }

                // Start new render task
                renderTask = page.render(renderContext);
                await renderTask.promise;

                if (!isMounted) return;

                // Get text content
                const textContent = await page.getTextContent();

                // Clear text layer
                if (textLayer && isMounted) {
                    textLayer.innerHTML = '';

                    // Set text layer dimensions
                    textLayer.style.width = `${viewport.width}px`;
                    textLayer.style.height = `${viewport.height}px`;
                    textLayer.style.position = 'absolute';
                    textLayer.style.left = '0';
                    textLayer.style.top = '0';
                    textLayer.style.transform = `scale(${scale})`;
                    textLayer.style.transformOrigin = '0 0';

                    // Create text elements
                    textContent.items.forEach((item) => {
                        if (!item || !item.str || !item.str.trim()) return;

                        const transform = item.transform;
                        if (!transform || transform.length < 6) return;

                        const fontSize = Math.abs(transform[0]) * 0.9;
                        const x = transform[4] + 1;
                        const y = viewport.height - transform[5] - fontSize;

                        let lineContainer = textLayer.querySelector(`[data-y="${y}"]`);
                        if (!lineContainer) {
                            lineContainer = document.createElement('div');
                            lineContainer.className = 'pdf-line';
                            lineContainer.dataset.y = y;
                            lineContainer.style.top = `${y}px`;
                            lineContainer.style.height = `${fontSize}px`;
                            textLayer.appendChild(lineContainer);
                        }

                        const div = document.createElement('div');
                        div.className = 'pdf-text-item';
                        div.textContent = item.str;

                        Object.assign(div.style, {
                            left: `${x}px`,
                            fontSize: `${fontSize}px`,
                            fontFamily: 'sans-serif',
                            position: 'absolute',
                            transformOrigin: 'left bottom',
                            whiteSpace: 'pre',
                            lineHeight: '1',
                            height: `${fontSize}px`,
                            display: 'inline-block',
                            padding: 0,
                            margin: 0
                        });

                        lineContainer.appendChild(div);
                    });

                    if (isMounted) {
                        renderHighlights(highlights, viewport);
                    }
                }
            } catch (err) {
                if (err.name === 'RenderingCancelledException') {
                    return; // Ignore cancelled render
                }
                console.error('Error rendering PDF:', err);
                if (isMounted) {
                    setError(`Error rendering PDF: ${err.message}`);
                }
            }
        };

        renderPage();

        // Cleanup function
        return () => {
            isMounted = false;
            if (renderTask) {
                renderTask.cancel();
            }
        };
    }, [pdf, currentPage, scale, highlights, renderHighlights]);

    const handleTextSelect = (text, page, position) => {
        setHighlights(prev => [...prev, {
            text,
            page,
            position,
            id: Date.now()
        }]);
    };

    const handleMouseDown = (e) => {
        if (e.target.closest('.text-layer')) {
            const textItem = e.target.closest('.pdf-text-item');
            if (textItem) {
                // Clear any existing selection
                window.getSelection().removeAllRanges();

                setSelectionStart({
                    element: textItem,
                    x: e.clientX,
                    y: e.clientY
                });
            }
        }
    };

    const handleMouseUp = (e) => {
        const selection = window.getSelection();
        const text = selection.toString().trim();

        if (text.length > 0 && selectionStart) {
            const isTextLayerSelection = e.target.closest('.text-layer');
            if (isTextLayerSelection) {
                const range = selection.getRangeAt(0);
                const textLayerRect = textLayerRef.current.getBoundingClientRect();
                const endElement = e.target.closest('.pdf-text-item');

                if (endElement && selectionStart.element) {
                    const startRect = selectionStart.element.getBoundingClientRect();
                    const endRect = endElement.getBoundingClientRect();

                    const isBackward = (startRect.top > endRect.top) ||
                                     (startRect.top === endRect.top && startRect.left > endRect.left);

                    const actualStartElement = isBackward ? endElement : selectionStart.element;
                    const actualEndElement = isBackward ? selectionStart.element : endElement;
                    const actualStartRect = isBackward ? endRect : startRect;
                    const actualEndRect = isBackward ? startRect : endRect;

                    const position = {
                        left: (actualStartRect.left - textLayerRect.left) / scale,
                        top: (actualStartRect.top - textLayerRect.top) / scale,
                        width: Math.abs(actualEndRect.right - actualStartRect.left) / scale,
                        height: Math.max(
                            actualEndRect.bottom - actualStartRect.top,
                            actualStartRect.bottom - actualEndRect.top
                        ) / scale
                    };

                    setSelectedText(text);
                    setCurrentSelection({
                        text,
                        page: currentPage,
                        position
                    });
                }
            }
        }
        setSelectionStart(null);
    };

    const handleMouseMove = useCallback((e) => {
        if (selectionStart) {
            const textLayer = textLayerRef.current;
            if (!textLayer) return;

            const currentElement = e.target.closest('.pdf-text-item');

            // Don't update selection if we're not over a text element
            if (!currentElement) return;

            const selection = window.getSelection();

            // Get all text elements between start and current
            const allTextElements = Array.from(textLayer.querySelectorAll('.pdf-text-item'));
            const startIndex = allTextElements.indexOf(selectionStart.element);
            const currentIndex = allTextElements.indexOf(currentElement);

            if (startIndex === -1 || currentIndex === -1) return;

            const isForward = startIndex <= currentIndex;
            const range = document.createRange();

            if (isForward) {
                range.setStart(selectionStart.element.firstChild || selectionStart.element, 0);
                range.setEnd(currentElement.firstChild || currentElement,
                    (currentElement.firstChild || currentElement).length);
            } else {
                range.setStart(currentElement.firstChild || currentElement, 0);
                range.setEnd(selectionStart.element.firstChild || selectionStart.element,
                    (selectionStart.element.firstChild || selectionStart.element).length);
            }

            selection.removeAllRanges();
            selection.addRange(range);
        }
    }, [selectionStart]);

    // Update handleZoom to use zoom levels
    const handleZoom = useCallback((delta) => {
        setZoomIndex(prevIndex => {
            const newIndex = Math.max(0, Math.min(ZOOM_LEVELS.length - 1, prevIndex + delta));
            setScale(ZOOM_LEVELS[newIndex]);
            return newIndex;
        });
    }, []);

    // Update handleWheel to only respond to Ctrl/Cmd + mouse wheel
    const handleWheel = useCallback((e) => {
        // Prevent default zoom behavior
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    }, []);

    // Add this to prevent browser zoom
    useEffect(() => {
        const preventZoom = (e) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                return false;
            }
        };

        document.addEventListener('wheel', preventZoom, { passive: false });
        return () => document.removeEventListener('wheel', preventZoom);
    }, []);

    // Add zoom to specific level
    const setZoomLevel = useCallback((level) => {
        const index = ZOOM_LEVELS.indexOf(level);
        if (index !== -1) {
            setZoomIndex(index);
            setScale(level);
        }
    }, []);

    const handleAddNote = useCallback((note) => {
        if (currentSelection) {
            setHighlights(prev => [...prev, {
                ...currentSelection,
                note,
                id: Date.now()
            }]);
            setCurrentSelection(null);
            setSelectedText('');
        }
    }, [currentSelection]);

    // Add effect to handle scrolling when page changes
    useEffect(() => {
        if (pageScrollPosition && viewerRef.current) {
            const { x, y } = pageScrollPosition;
            viewerRef.current.scrollTo(x * scale, y * scale);
        }
    }, [currentPage, pageScrollPosition, scale]);

    // Add effect to handle scrolling
    useEffect(() => {
        if (scrollPosition && textLayerRef.current) {
            const container = textLayerRef.current.parentElement.parentElement;
            container.scrollTo({
                top: scrollPosition.y * scale,
                left: scrollPosition.x * scale,
                behavior: 'smooth'
            });
            setScrollPosition(null); // Reset after scrolling
        }
    }, [currentPage, scale, scrollPosition]);

    useEffect(() => {
        const loadHighlights = async () => {
            try {
                const response = await highlightsAPI.getHighlightsByPdf(id);
                
                if (response.status === 200) {
                    setHighlights(response.data);
                }
            } catch (error) {
                console.error('Error loading highlights:', error);
            }
        };

        if (id) {
            loadHighlights();
        }
    }, [id]);

    const handleTextSelection = async () => {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const pageElement = range.commonAncestorContainer.closest('.pdf-page');
        if (!pageElement) return;

        const pageNumber = parseInt(pageElement.dataset.pageNumber);
        const pageRect = pageElement.getBoundingClientRect();

        const highlight = {
            text: selection.toString(),
            page_number: pageNumber,
            position: {
                x1: (rect.left - pageRect.left) / pageRect.width,
                y1: (rect.top - pageRect.top) / pageRect.height,
                x2: (rect.right - pageRect.left) / pageRect.width,
                y2: (rect.bottom - pageRect.top) / pageRect.height
            },
            color: selectedColor,
            note: '',
            timestamp: new Date().toISOString()
        };

        try {
            const response = await highlightsAPI.createHighlight(id, highlight);

            if (response.status === 201) {
                setHighlights(prev => [...prev, response.data]);
            }
        } catch (error) {
            console.error('Error saving highlight:', error);
        }
    };

    // Add this effect to handle TOC collapse state changes
    useEffect(() => {
        const handleTocStateChange = (e) => {
            if (e.detail && e.detail.isExpanded !== undefined) {
                const newCollapsedState = !e.detail.isExpanded;
                
                // If state is changing (not just re-rendering with same state)
                if (newCollapsedState !== tocCollapsed) {
                    if (newCollapsedState) {
                        // When COLLAPSING
                        // Save current widths for later restoration
                        const currentIndexWidth = indexWidth;
                        const currentChatWidth = chatWidth;
                        
                        setPreviousIndexWidth(currentIndexWidth);
                        setPreviousChatWidth(currentChatWidth);
                        
                        // Set TOC width to minimum
                        setIndexWidth(48);
                        
                        // Increase chat window width
                        const extraSpace = currentIndexWidth - 48; // Space freed up by TOC
                        const newChatWidth = Math.min(currentChatWidth + (extraSpace / 3), 600); // Some extra to chat
                        setChatWidth(newChatWidth);
                    } else {
                        // When EXPANDING
                        // Restore previous widths
                        setIndexWidth(previousIndexWidth);
                        setChatWidth(previousChatWidth);
                    }
                    
                    setTocCollapsed(newCollapsedState);
                }
            }
        };
        
        window.addEventListener('tocStateChanged', handleTocStateChange);
        return () => {
            window.removeEventListener('tocStateChanged', handleTocStateChange);
        };
    }, [tocCollapsed, indexWidth, previousIndexWidth, chatWidth, previousChatWidth]);

    return (
        <div className="pdf-viewer-page">
            <div className="pdf-viewer-container">
                <div className="pdf-controls">
                    <button className="back-button" onClick={() => navigate('/')}>
                        <span className="material-icons">arrow_back</span>
                        Back to Library
                    </button>

                    <div className="zoom-controls">
                        <button onClick={() => handleZoom(-1)} disabled={zoomIndex === 0}>
                            <span className="material-icons">remove</span>
                        </button>
                        <select
                            value={ZOOM_LEVELS[zoomIndex]}
                            onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
                            className="zoom-select"
                        >
                            {ZOOM_LEVELS.map(level => (
                                <option key={level} value={level}>
                                    {Math.round(level * 100)}%
                                </option>
                            ))}
                        </select>
                        <button onClick={() => handleZoom(1)} disabled={zoomIndex === ZOOM_LEVELS.length - 1}>
                            <span className="material-icons">add</span>
                        </button>
                    </div>

                    <div className="navigation-group">
                        <button onClick={() => changePage(-1)} disabled={currentPage <= 1}>
                            <span className="material-icons">navigate_before</span>
                            Previous
                        </button>
                        <div className="page-info">
                            Page {currentPage} of {totalPages}
                        </div>
                        <button onClick={() => changePage(1)} disabled={currentPage >= totalPages}>
                            Next
                            <span className="material-icons">navigate_next</span>
                        </button>
                    </div>
                </div>
                <div
                    className={`pdf-content ${tocCollapsed ? 'toc-collapsed' : ''}`}
                    onWheel={handleWheel}
                >
                    <ResizablePanel
                        width={tocCollapsed ? 48 : indexWidth}
                        minWidth={tocCollapsed ? 48 : 100}
                        maxWidth={tocCollapsed ? 48 : 400}
                        onResize={(width) => {
                            // Only allow resizing when TOC is expanded
                            if (!tocCollapsed) {
                                setIndexWidth(width);
                                // When resizing the index width, also update previous width
                                // This ensures we restore to the new width when expanded again
                                setPreviousIndexWidth(width);
                            }
                        }}
                        position="left"
                    >
                        <PdfIndex
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageSelect={handlePageChange}
                            pdf={pdf}
                            onToggle={(isExpanded) => {
                                // Update tocCollapsed state
                                setTocCollapsed(!isExpanded);
                                // Dispatch custom event to notify about TOC state change
                                window.dispatchEvent(new CustomEvent('tocStateChanged', { 
                                    detail: { isExpanded } 
                                }));
                            }}
                        />
                    </ResizablePanel>

                    <div className="pdf-viewer"
                        onMouseUp={handleMouseUp}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                    >
                        {isLoading ? (
                            <div className="loading">Loading PDF...</div>
                        ) : error ? (
                            <div className="error-message">{error}</div>
                        ) : (
                            <div className="page-transition-wrapper">
                                <div className={`pdf-page-container ${pageTransition}`}
                                     style={{
                                         transformOrigin: transitionDirection === 'next' ? 'left center' : 'right center'
                                     }}
                                >
                                    <canvas ref={viewerRef} />
                                    <div
                                        ref={textLayerRef}
                                        className={`text-layer ${hoveredElement !== null ? 'hovering' : ''}`}
                                        data-hovered-paragraph={hoveredElement}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <ResizablePanel
                        width={chatWidth}
                        minWidth={250}
                        maxWidth={tocCollapsed ? 700 : 600} /* Allow more width when TOC is collapsed */
                        onResize={(width) => {
                            setChatWidth(width);
                            // When manually resizing, also update previous width
                            // This ensures we restore to the new width when TOC is expanded
                            setPreviousChatWidth(width);
                        }}
                        position="right"
                    >
                        <div className="right-panel">
                            <ChatWindow
                                initialContext={selectedText}
                                onAddNote={handleAddNote}
                                currentSelection={currentSelection}
                                pdfId={id}
                                currentPage={currentPage}
                            />
                        </div>
                    </ResizablePanel>
                </div>
            </div>
        </div>
    );
}
