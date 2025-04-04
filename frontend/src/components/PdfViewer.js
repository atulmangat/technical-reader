import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import * as pdfjsLib from "pdfjs-dist";
import "pdfjs-dist/web/pdf_viewer.css";
import '../css/PdfViewer.css'; // Import the custom PDF viewer styles
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { PdfIndex } from './PdfIndex';
import { ResizablePanel } from './ResizablePanel';
import ChatWindow from './ChatWindow';
import { pdfAPI, highlightsAPI, ragAPI } from '../services/api';
import { TextLayerBuilder } from "pdfjs-dist/build/pdf";

// Set worker path correctly
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// Add these zoom-related constants at the top of the file
const ZOOM_LEVELS = [0.5, 0.75, 1.0, 1.25, 1.50, 1.75, 2.0, 2.5, 3.0];
const DEFAULT_ZOOM_INDEX = 4; // 1.75 is the default zoom level
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 5.0;

// For development: set to true to see text layer boxes for debugging alignment issues
const DEBUG_TEXT_BOXES = false;

// Add a helper function to fix text layer offsets
const removeTextLayerOffset = (textLayer) => {
    if (!textLayer) return;
    // Remove text layer inline styles that can cause misalignment
    textLayer.style.top = '0';
    textLayer.style.left = '0';
    textLayer.style.transform = '';
    // Crucial for alignment - set origin at top left
    textLayer.style.transformOrigin = 'top left';
};

export function PdfViewer() {
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const viewerRef = useRef(null);
    const textLayerRef = useRef(null);
    const [pdf, setPdf] = useState(null);
    const [error, setError] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [scale, setScale] = useState(1.75);
    const [isLoading, setIsLoading] = useState(true);
    const [highlights, setHighlights] = useState([]);
    const [indexWidth, setIndexWidth] = useState(48);
    const [chatWidth, setChatWidth] = useState(600);
    const [selectedText, setSelectedText] = useState('');
    const [currentSelection, setCurrentSelection] = useState(null);
    const [menuPosition, setMenuPosition] = useState(null);
    const [showHighlightPalette, setShowHighlightPalette] = useState(false);
    const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX);
    const [customZoom, setCustomZoom] = useState('175');
    const [lastPinchDistance, setLastPinchDistance] = useState(null);
    const [selectionStart, setSelectionStart] = useState(null);
    const [pageTransition, setPageTransition] = useState('page-current');
    const [transitionDirection, setTransitionDirection] = useState('next');
    const [scrollPosition, setScrollPosition] = useState(null);
    const [tocCollapsed, setTocCollapsed] = useState(true);
    const [previousIndexWidth, setPreviousIndexWidth] = useState(300);
    const [previousChatWidth, setPreviousChatWidth] = useState(500);
    const [scrollIndicator, setScrollIndicator] = useState({ visible: false, progress: 0, direction: 'next' });
    const [currentSectionTitle, setCurrentSectionTitle] = useState('');
    const [pageInputValue, setPageInputValue] = useState('');
    const [initialPageLoaded, setInitialPageLoaded] = useState(false);
    const pageChangeTimeoutRef = useRef(null);

    // Add state for controls visibility
    const [controlsVisible, setControlsVisible] = useState(true);
    const controlsRef = useRef(null);
    const lastScrollY = useRef(0);
    const scrollTimeoutRef = useRef(null);
    const wheelDebounceTimeoutRef = useRef(null);
    
    // Add references for tracking scroll resistance
    const cumulativeScrollRef = useRef(0);
    const resistanceThresholdRef = useRef(200); // Increased threshold for more resistance
    const isAtBoundaryRef = useRef(false);

    // Add state for search functionality
    const [searchVisible, setSearchVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [currentResultIndex, setCurrentResultIndex] = useState(-1);
    const [isSearching, setIsSearching] = useState(false);
    const [matchCase, setMatchCase] = useState(false);
    const searchInputRef = useRef(null);

    // Add a ref for the text selection menu
    const menuRef = useRef(null);

    // Add a ref to access the ChatWindow component
    const chatWindowRef = useRef(null);

    // Add handler for highlight deletion - moved up before being used
    const handleDeleteHighlight = useCallback((highlightId) => {
        // Find the highlight in our local state
        const highlightToDelete = highlights.find(h => 
            (h.id === highlightId) || (h.highlight_id === highlightId)
        );
        
        if (!highlightToDelete) return;
        
        // Determine the API ID based on the source
        const apiHighlightId = highlightToDelete.highlight_id || highlightToDelete.id;
        
        // Call the API to delete the highlight
        highlightsAPI.deleteHighlight(id, apiHighlightId)
            .then(() => {
                console.log('Highlight deleted successfully');
                // Update the local state
                setHighlights(prev => prev.filter(h => 
                    (h.id !== highlightId) && (h.highlight_id !== highlightId)
                ));
            })
            .catch(error => {
                console.error('Error deleting highlight:', error);
            });
    }, [highlights, id]);

    // First, define handlePageChange
    const handlePageChange = useCallback((newPage, scrollTo = null) => {
        const direction = newPage > currentPage ? 'next' : 'prev';
        setTransitionDirection(direction);

        // Start exit animation
        setPageTransition('page-exit');

        // After small delay, change page and start enter animation
        setTimeout(() => {
            setCurrentPage(newPage);
            setPageInputValue(newPage.toString());
            setPageTransition('page-enter');

            // Always reset scroll position to top when changing pages
            const container = document.querySelector('.pdf-viewer');
            if (container) {
                container.scrollTop = 0;
            }

            // Set scroll position if provided (but only if explicitly requested)
            if (scrollTo) {
                setScrollPosition(scrollTo);
            }

            // After enter animation starts, move to current state
            setTimeout(() => {
                setPageTransition('page-current');
            }, 50);
            
            // Clear any existing timeout
            if (pageChangeTimeoutRef.current) {
                clearTimeout(pageChangeTimeoutRef.current);
            }
            
            // Set a timeout to update the current page after 2 seconds
            pageChangeTimeoutRef.current = setTimeout(() => {
                // Save the current page to the backend
                pdfAPI.updateCurrentPage(id, newPage)
                    .then(() => {
                        console.log(`Saved page ${newPage} for PDF ${id}`);
                    })
                    .catch(error => {
                        console.error('Error saving current page:', error);
                    });
            }, 2000);
        }, 150);
    }, [currentPage, id]);

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
            // Handle both local highlights and those from the API
            const isLocalHighlight = highlight.page !== undefined;
            const highlightPage = isLocalHighlight ? highlight.page : highlight.page_number;
            
            if (highlightPage === currentPage) {
                // Create highlight container
                const highlightContainer = document.createElement('div');
                highlightContainer.className = 'highlight-container';
                highlightContainer.style.position = 'absolute';
                
                // Create highlight element
                const div = document.createElement('div');
                div.className = 'highlight';
                div.style.position = 'absolute';
                div.style.width = '100%';
                div.style.height = '100%';
                div.setAttribute('data-highlight-id', highlight.id || highlight.highlight_id);
                
                // Set the background color
                div.style.backgroundColor = highlight.color || 'rgba(255, 255, 0, 0.3)';
                
                // Set the position based on the source format
                if (isLocalHighlight) {
                    // Local highlight
                    highlightContainer.style.left = `${highlight.position.left}px`;
                    highlightContainer.style.top = `${highlight.position.top}px`;
                    highlightContainer.style.width = `${highlight.position.width}px`;
                    highlightContainer.style.height = `${highlight.position.height}px`;
                } else {
                    // API highlight - calculate from x_start, y_start, x_end, y_end
                    highlightContainer.style.left = `${highlight.x_start}px`;
                    highlightContainer.style.top = `${highlight.y_start}px`;
                    highlightContainer.style.width = `${highlight.x_end - highlight.x_start}px`;
                    highlightContainer.style.height = `${highlight.y_end - highlight.y_start}px`;
                }
                
                // Add tooltip with note if available
                const note = highlight.note || '';
                div.title = note;
                
                // Create delete button
                const deleteButton = document.createElement('div');
                deleteButton.className = 'highlight-delete-button';
                deleteButton.innerHTML = '×';
                deleteButton.title = 'Delete highlight';
                deleteButton.setAttribute('data-highlight-id', highlight.id || highlight.highlight_id);
                
                // Add click event to delete button
                deleteButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const highlightId = deleteButton.getAttribute('data-highlight-id');
                    if (window.confirm('Delete this highlight?')) {
                        handleDeleteHighlight(highlightId);
                    }
                });
                
                // Add the highlight and delete button to the container
                highlightContainer.appendChild(div);
                highlightContainer.appendChild(deleteButton);
                
                // Add the container to the layer
                highlightLayer.appendChild(highlightContainer);
            }
        });

        container.appendChild(highlightLayer);
    }, [currentPage, handleDeleteHighlight]);

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

                // First get the PDF metadata to check if there's a saved page
                const metadataResponse = await pdfAPI.getAllPdfs();
                const pdfMetadata = metadataResponse.data.find(pdf => pdf.id === id);
                const savedPage = pdfMetadata?.current_page || 1;

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
                
                // Set initialPageLoaded to false initially
                setInitialPageLoaded(false);
                
                // Load the saved page if it exists and is valid
                if (savedPage > 1 && savedPage <= pdfDoc.numPages) {
                    setCurrentPage(savedPage);
                    setPageInputValue(savedPage.toString());
                }
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
        
        // Clean up page change timeout on unmount
        return () => {
            if (pageChangeTimeoutRef.current) {
                clearTimeout(pageChangeTimeoutRef.current);
            }
        };
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

                    // Ensure text layer and canvas have the same container dimensions
                    textLayer.style.position = 'absolute';
                    textLayer.style.top = '0';
                    textLayer.style.left = '0';
                    textLayer.style.width = `${viewport.width * scale}px`;
                    textLayer.style.height = `${viewport.height * scale}px`;
                    textLayer.style.transformOrigin = 'top left';
                    
                    // Create a scaled viewport for text layer positioning
                    const scaledViewport = viewport.clone({ scale: scale });
                    
                    // Get styles map for font adjustments
                    const styles = textContent.styles || {};
                    
                    textContent.items.forEach(item => {
                        if (!item.str.trim()) return;
                        
                        // Get the item's transform matrix and apply scaling
                        const tx = item.transform;
                        if (!tx || tx.length !== 6) return;
                        
                        // Calculate the font size and position using consistent scaling
                        const fontSize = Math.sqrt((tx[2] * tx[2]) + (tx[3] * tx[3])) * scale;
                        
                        // Get current font style for potential ascent/descent adjustment
                        const style = styles[item.fontName] || {};
                        
                        // Adjust positioning for perfect alignment
                        let left = tx[4] * scale;
                        let top = (viewport.height - tx[5]) * scale;
                        
                        // Apply ascent/descent adjustment to fix vertical alignment
                        if (style.ascent) {
                            top -= fontSize * style.ascent * 0.7; // Adjust factor as needed
                        } else if (style.descent) {
                            top -= fontSize * (1 + style.descent * 0.7);
                        } else {
                            // If no font metadata, apply a standard adjustment
                            top -= fontSize * 0.35; // Fine-tune this value based on your PDFs
                        }
                        
                        // Calculate text width more accurately
                        let width;
                        if (item.width) {
                            // Use the item's width if available
                            width = item.width * viewport.scale * scale;
                        } else {
                            // Estimate width based on font size and string length
                            // This is a rough approximation - adjust the multiplier based on your font
                            width = item.str.length * fontSize * 0.58;
                        }
                        
                        // Add a small padding to the width (1-2px on each side)
                        width += 4;
                        
                        // Create the text element
                        const element = document.createElement('span');
                        element.textContent = item.str;
                        element.style.position = 'absolute';
                        element.style.left = `${left}px`;
                        element.style.top = `${top}px`;
                        element.style.fontSize = `${fontSize}px`;
                        element.style.fontFamily = item.fontName || 'sans-serif';
                        element.style.whiteSpace = 'pre';
                        element.style.transform = 'scale(1)'; // Ensure no additional transform
                        element.style.transformOrigin = 'left bottom'; // Important for text alignment
                        element.style.width = `${width}px`; // Set explicit width
                        element.style.height = `${fontSize * 1.2}px`; // Set explicit height based on font size
                        element.style.color = 'transparent';
                        element.style.backgroundColor = 'transparent';
                        element.style.userSelect = 'text';
                        element.style.cursor = 'text';
                        element.style.pointerEvents = 'all';
                        
                        // Add debug visualization if enabled
                        if (DEBUG_TEXT_BOXES) {
                            element.style.border = '1px solid rgba(0, 0, 255, 0.2)';
                            element.style.backgroundColor = 'rgba(173, 216, 230, 0.1)';
                            element.style.color = 'rgba(0, 0, 0, 0.2)';
                        }
                        
                        // Make text selectable but visually transparent
                        element.classList.add('pdf-text');
                        element.dataset.textContent = item.str;
                        
                        textLayer.appendChild(element);
                    });

                    // Apply the fix to ensure no additional offsets are applied
                    removeTextLayerOffset(textLayer);

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

    const handleMouseDown = (e) => {
        if (e.target.classList.contains('pdf-text')) {
            // Only set selection start when clicking on a text element
            setSelectionStart({ x: e.clientX, y: e.clientY });
        }
    };

    const handleMouseUp = (e) => {
        const selection = window.getSelection();
        const text = selection.toString().trim();

        if (text.length > 0 && selectionStart) {
            const isTextLayerSelection = e.target.closest('.text-layer');
            if (isTextLayerSelection && textLayerRef.current) { // Added null check for textLayerRef
                const textLayerRect = textLayerRef.current.getBoundingClientRect();
                
                // Ensure there's a selection range
                if (selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    const rects = range.getClientRects();
                    
                    if (rects.length > 0) {
                        const firstRect = rects[0];
                        const boundingBox = range.getBoundingClientRect();
                        
                        // Calculate position relative to the text layer and scale
                        const adjustedPosition = {
                            left: (boundingBox.left - textLayerRect.left) / scale,
                            top: (boundingBox.top - textLayerRect.top) / scale,
                            width: boundingBox.width / scale,
                            height: boundingBox.height / scale
                        };

                        // Defer state updates slightly using setTimeout 0
                        setTimeout(() => {
                            setSelectedText(text);
                            setCurrentSelection({
                                text,
                                page: currentPage,
                                position: adjustedPosition
                            });
                            // Set menu position after state updates are likely processed
                            setMenuPosition({ x: firstRect.left, y: firstRect.top - 40 });
                        }, 0);
                    }
                } // else: No range found, do nothing
            } // else: Not a text layer selection or ref is missing, do nothing
        } else {
            // Clear the menu when clicking elsewhere or when there's no selection
            // Defer this clear operation as well for consistency
            setTimeout(() => {
                if (window.getSelection().toString().trim().length === 0) {
                     setMenuPosition(null);
                     setShowHighlightPalette(false);
                     // Optionally clear currentSelection/selectedText if needed
                     // setCurrentSelection(null);
                     // setSelectedText('');
                }
            }, 0);
        }
        // Reset selection start immediately
        setSelectionStart(null);
    };

    // With the improved text layer, we don't need custom mouse move handler for selection
    const handleMouseMove = useCallback((e) => {
        // Let browser handle text selection
    }, [selectionStart]);

    // Add pinch zoom functionality with touch events
    const handleTouchStart = useCallback((e) => {
        if (e.touches.length === 2) {
            // Calculate initial distance between two touch points
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const distance = Math.hypot(
                touch2.clientX - touch1.clientX,
                touch2.clientY - touch1.clientY
            );
            setLastPinchDistance(distance);
            e.preventDefault(); // Prevent default to avoid page scroll/zoom
        }
    }, []);

    const handleTouchMove = useCallback((e) => {
        if (e.touches.length === 2 && lastPinchDistance !== null) {
            // Calculate new distance between touch points
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const distance = Math.hypot(
                touch2.clientX - touch1.clientX,
                touch2.clientY - touch1.clientY
            );
            
            // Calculate zoom factor based on change in distance
            const delta = distance / lastPinchDistance;
            
            // Apply zoom if the change is significant enough
            if (Math.abs(delta - 1) > 0.02) {
                const newScale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale * delta));
                setScale(newScale);
                setCustomZoom(Math.round(newScale * 100).toString());
                
                // Find closest zoom level and update zoomIndex
                let closestIndex = 0;
                let minDiff = Math.abs(ZOOM_LEVELS[0] - newScale);
                
                for (let i = 1; i < ZOOM_LEVELS.length; i++) {
                    const diff = Math.abs(ZOOM_LEVELS[i] - newScale);
                    if (diff < minDiff) {
                        minDiff = diff;
                        closestIndex = i;
                    }
                }
                
                setZoomIndex(closestIndex);
                setLastPinchDistance(distance);
            }
            
            e.preventDefault(); // Prevent default to avoid page scroll/zoom
        }
    }, [lastPinchDistance, scale]);

    const handleTouchEnd = useCallback(() => {
        setLastPinchDistance(null);
    }, []);

    // Update handleWheel to include improved scroll resistance with visual feedback
    const handleWheel = useCallback((e) => {
        // Prevent default zoom behavior when Ctrl/Cmd is pressed
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
        
        // Get the container element
        const container = e.currentTarget;
        if (!container) return;
        
        // Check if we're within the PDF viewer or its child elements
        const target = e.target;
        
        // If mouse is over TOC or Chat window components, don't scroll the PDF
        const pdfViewer = document.querySelector('.pdf-viewer');
        if (!pdfViewer || !pdfViewer.contains(target)) {
            return;
        }
        
        // Check if we're at the top or bottom of the page
        const isAtTop = container.scrollTop <= 2;
        const isAtBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 2;
        
        // Handle regular scrolling through pages only at boundaries
        if (Math.abs(e.deltaY) > 5) {
            // Check if we're at a boundary and which direction we're scrolling
            const scrollingDown = e.deltaY > 0;
            const isAtBoundary = (scrollingDown && isAtBottom && currentPage < totalPages) || 
                               (!scrollingDown && isAtTop && currentPage > 1);
            
            // Reset cumulative scroll if we've moved away from a boundary
            if (!isAtBoundary) {
                cumulativeScrollRef.current = 0;
                isAtBoundaryRef.current = false;
                setScrollIndicator({ visible: false, progress: 0, direction: 'next' });
                return;
            }
            
            // If this is the first scroll at boundary, mark it
            if (!isAtBoundaryRef.current) {
                isAtBoundaryRef.current = true;
                cumulativeScrollRef.current = 0;
            }
            
            // Accumulate scroll amount, but apply a penalty to make it harder
            // Use a non-linear accumulation to create more resistance
            const scrollIncrement = Math.min(Math.abs(e.deltaY), 20);
            cumulativeScrollRef.current += scrollIncrement * 0.8;
            
            // Calculate progress percentage
            const progressPercent = Math.min(100, (cumulativeScrollRef.current / resistanceThresholdRef.current) * 100);
            
            // Update the scroll indicator
            setScrollIndicator({
                visible: true,
                progress: progressPercent,
                direction: scrollingDown ? 'next' : 'prev'
            });
            
            // Only change page when accumulated scroll exceeds the resistance threshold
            if (cumulativeScrollRef.current > resistanceThresholdRef.current) {
                // Reset the accumulated scroll and hide the indicator
                cumulativeScrollRef.current = 0;
                setScrollIndicator({ visible: false, progress: 0, direction: 'next' });
                
                // Add small debounce to avoid too rapid page changes
                if (!wheelDebounceTimeoutRef.current) {
                    wheelDebounceTimeoutRef.current = setTimeout(() => {
                        wheelDebounceTimeoutRef.current = null;
                    }, 300);
                    
                    if (scrollingDown && isAtBottom) {
                        changePage(1);
                    } else if (!scrollingDown && isAtTop) {
                        changePage(-1);
                    }
                }
            }
        }
    }, [changePage, currentPage, totalPages]);

    // Add this to prevent browser zoom
    useEffect(() => {
        const preventZoom = (e) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                return false;
            }
        };

        document.addEventListener('wheel', preventZoom, { passive: false });
        return () => {
            document.removeEventListener('wheel', preventZoom);
            // Clear wheel debounce timeout if it exists
            if (wheelDebounceTimeoutRef.current) {
                clearTimeout(wheelDebounceTimeoutRef.current);
            }
        };
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

    const handleHighlightSelection = useCallback((color) => {
        if (currentSelection) {
            const temporaryId = 'temp-' + Date.now();
            // Save the highlight to the local state immediately with a temporary ID
            const newHighlight = { 
                ...currentSelection, 
                color, 
                id: temporaryId, // Use temporary ID
                highlight_id: null, // Indicate it's not saved yet
                isSaving: true, // Optional: Add a flag for visual feedback
            };
            setHighlights(prev => [...prev, newHighlight]);
            
            // Prepare data for the backend API
            const highlightData = {
                content: currentSelection.text,
                page_number: currentSelection.page,
                x_start: currentSelection.position.left,
                y_start: currentSelection.position.top,
                x_end: currentSelection.position.left + currentSelection.position.width,
                y_end: currentSelection.position.top + currentSelection.position.height,
                color: color,
                note: "" // Default empty note
            };
            
            // Store current selection details before clearing
            const selectionToClear = currentSelection;
            
            // Clear the selection UI immediately after initiating the save
            setCurrentSelection(null);
            setSelectedText('');
            setMenuPosition(null);
            setShowHighlightPalette(false);
            
            // Call the API to create the highlight
            highlightsAPI.createHighlight(id, highlightData)
              .then(response => {
                  console.log('Highlight saved successfully:', response.data);
                  const savedHighlight = response.data; // Assuming API returns the saved highlight with its ID
                  
                  // Update the specific highlight in the local state with the confirmed ID from the backend
                  setHighlights(prev => prev.map(h => {
                      if (h.id === temporaryId) {
                          // Update the temporary highlight with real data from API
                          return { 
                              ...h, 
                              id: savedHighlight.highlight_id || savedHighlight.id, // Use the backend ID
                              highlight_id: savedHighlight.highlight_id || savedHighlight.id, 
                              isSaving: false,
                              // Map other fields from savedHighlight if necessary
                              page_number: savedHighlight.page_number,
                              x_start: savedHighlight.x_start,
                              y_start: savedHighlight.y_start,
                              x_end: savedHighlight.x_end,
                              y_end: savedHighlight.y_end,
                              color: savedHighlight.color,
                              note: savedHighlight.note,
                              content: savedHighlight.content,
                          };
                      }
                      return h; // Keep other highlights as they are
                  }));
                  
                  // NOTE: We removed the loadHighlights() call here to avoid overwriting the state
                  
              })
              .catch(error => {
                  console.error('Error saving highlight:', error);
                  // If saving failed, remove the temporary highlight from local state
                  setHighlights(prev => prev.filter(h => h.id !== temporaryId));
                  
                  // Optionally: Restore selection state or show an error message
                  // setCurrentSelection(selectionToClear); 
                  // setSelectedText(selectionToClear.text);
                  alert('Failed to save highlight. Please try again.'); 
              });
        }
    }, [currentSelection, id]); // Removed loadHighlights dependency as it's no longer directly called

    // Update handleZoom to update customZoom state
    const handleZoom = useCallback((delta) => {
        setZoomIndex(prevIndex => {
            const newIndex = Math.max(0, Math.min(ZOOM_LEVELS.length - 1, prevIndex + delta));
            const newScale = ZOOM_LEVELS[newIndex];
            setScale(newScale);
            setCustomZoom(Math.round(newScale * 100).toString());
            return newIndex;
        });
    }, []);

    // Add function to handle custom zoom input change
    const handleCustomZoomChange = useCallback((e) => {
        // Only allow numeric input
        const inputValue = e.target.value.replace(/[^0-9]/g, '');
        
        // Limit to 3 digits (can't go above 500%)
        if (inputValue.length <= 3) {
            setCustomZoom(inputValue);
        }
    }, []);

    // Add function to handle custom zoom input submission
    const handleCustomZoomSubmit = useCallback((e) => {
        if (e.key === 'Enter' || e.type === 'blur') {
            let zoomValue = parseInt(customZoom, 10);
            
            // Validate zoom value
            if (isNaN(zoomValue) || zoomValue < MIN_ZOOM * 100) {
                zoomValue = MIN_ZOOM * 100;
            } else if (zoomValue > MAX_ZOOM * 100) {
                zoomValue = MAX_ZOOM * 100;
            }
            
            // Convert percentage to scale factor
            const newScale = zoomValue / 100;
            setScale(newScale);
            setCustomZoom(zoomValue.toString());
            
            // Update zoom index to closest preset zoom level
            let closestIndex = 0;
            let minDiff = Math.abs(ZOOM_LEVELS[0] - newScale);
            
            for (let i = 1; i < ZOOM_LEVELS.length; i++) {
                const diff = Math.abs(ZOOM_LEVELS[i] - newScale);
                if (diff < minDiff) {
                    minDiff = diff;
                    closestIndex = i;
                }
            }
            
            setZoomIndex(closestIndex);
        }
    }, [customZoom]);

    // Add effect to handle scrolling when page changes
    useEffect(() => {
        if (viewerRef.current && scrollPosition) {
            viewerRef.current.scrollTo(scrollPosition.x * scale, scrollPosition.y * scale);
        }
    }, [currentPage, scale, scrollPosition]);

    // Extract loadHighlights as a memoized function
    const loadHighlights = useCallback(async () => {
        try {
            const response = await highlightsAPI.getHighlightsByPdf(id);
            
            if (response.status === 200) {
                setHighlights(response.data);
            }
        } catch (error) {
            console.error('Error loading highlights:', error);
        }
    }, [id]);
    
    // Use the extracted function in the useEffect
    useEffect(() => {
        if (id) {
            loadHighlights();
        }
    }, [id, loadHighlights]);

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

    useEffect(() => {
        const indexingTime = parseInt(searchParams.get('indexing'));
        if (indexingTime) {
            // Remove the indexing parameter from URL after delay
            const timeout = setTimeout(() => {
                const newParams = new URLSearchParams(searchParams);
                newParams.delete('indexing');
                navigate(`/pdf/${id}?${newParams.toString()}`, { replace: true });
            }, indexingTime);
            
            return () => clearTimeout(timeout);
        }
    }, [searchParams, id, navigate]);

    // Add scroll detection to hide/show controls
    useEffect(() => {
        const handleScroll = () => {
            const pdfViewer = document.querySelector('.pdf-viewer');
            if (!pdfViewer) return;
            
            const currentScrollY = pdfViewer.scrollTop;
            const scrollingDown = currentScrollY > lastScrollY.current;
            const scrollThreshold = 10; // Even lower threshold for more responsive hiding
            const scrollDelta = Math.abs(currentScrollY - lastScrollY.current);
            
            // Clear any existing timeout to avoid race conditions
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }
            
            // When scrolling significantly, handle visibility immediately
            if (scrollDelta > scrollThreshold) {
                // Hide controls immediately when scrolling down
                if (scrollingDown && controlsVisible) {
                    setControlsVisible(false);
                } 
                // Show controls immediately when scrolling up
                else if (!scrollingDown && !controlsVisible) {
                    setControlsVisible(true);
                }
            }
            
            // Set last scroll position without delay
            lastScrollY.current = currentScrollY;
            
            // Only use timeout for stopping at edges
            scrollTimeoutRef.current = setTimeout(() => {
                // Only show controls automatically when at top or bottom of document
                const isAtTop = currentScrollY < 50;
                const isNearBottom = pdfViewer.scrollHeight - pdfViewer.scrollTop - pdfViewer.clientHeight < 50;
                
                if ((isAtTop || isNearBottom) && !controlsVisible) {
                    setControlsVisible(true);
                }
            }, 300);
        };
        
        const pdfViewer = document.querySelector('.pdf-viewer');
        if (pdfViewer) {
            pdfViewer.addEventListener('scroll', handleScroll, { passive: true });
            return () => {
                pdfViewer.removeEventListener('scroll', handleScroll);
                if (scrollTimeoutRef.current) {
                    clearTimeout(scrollTimeoutRef.current);
                }
            };
        }
    }, [controlsVisible]);

    // Add this function to handle page input change
    const handlePageInputChange = (e) => {
        setPageInputValue(e.target.value);
    };

    // Add this function to handle page input submission
    const handlePageInputSubmit = (e) => {
        e.preventDefault();
        const pageNumber = parseInt(pageInputValue, 10);
        if (!isNaN(pageNumber) && pageNumber >= 1 && pageNumber <= totalPages) {
            handlePageChange(pageNumber);
        } else {
            // Reset input to current page if invalid
            setPageInputValue(currentPage.toString());
        }
    };

    // Initialize page input value with current page
    useEffect(() => {
        setPageInputValue(currentPage.toString());
    }, [currentPage]);

    // Add effect to find current section in the outline
    useEffect(() => {
        const findCurrentSection = async () => {
            if (!pdf) return;
            
            try {
                const outline = await pdf.getOutline();
                if (!outline || outline.length === 0) return;
                
                let currentTitle = '';
                let lastFoundPage = 0;
                
                // Helper function to recursively search the outline
                const searchOutline = async (items) => {
                    for (const item of items) {
                        if (item.dest) {
                            try {
                                const destination = await pdf.getDestination(item.dest);
                                if (destination) {
                                    const pageRef = destination[0];
                                    const pageNumber = await pdf.getPageIndex(pageRef) + 1;
                                    
                                    // Update title if this section is before or on our current page
                                    // and it's newer (higher page number) than our previous match
                                    if (pageNumber <= currentPage && pageNumber > lastFoundPage) {
                                        lastFoundPage = pageNumber;
                                        currentTitle = item.title;
                                    }
                                }
                            } catch (error) {
                                console.error('Error determining page for outline item:', error);
                            }
                        }
                        
                        // Recursively search children
                        if (item.items && item.items.length > 0) {
                            await searchOutline(item.items);
                        }
                    }
                };
                
                await searchOutline(outline);
                setCurrentSectionTitle(currentTitle);
                
            } catch (error) {
                console.error('Error finding current section:', error);
            }
        };
        
        findCurrentSection();
    }, [pdf, currentPage]);

    // Add another useEffect for touch events
    useEffect(() => {
        const pdfViewer = document.querySelector('.pdf-viewer');
        
        if (pdfViewer) {
            pdfViewer.addEventListener('touchstart', handleTouchStart, { passive: false });
            pdfViewer.addEventListener('touchmove', handleTouchMove, { passive: false });
            pdfViewer.addEventListener('touchend', handleTouchEnd);
            
            return () => {
                pdfViewer.removeEventListener('touchstart', handleTouchStart);
                pdfViewer.removeEventListener('touchmove', handleTouchMove);
                pdfViewer.removeEventListener('touchend', handleTouchEnd);
            };
        }
    }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

    // Add search handling
    const handleSearchKeyDown = useCallback((e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'f' && !searchVisible) {
            e.preventDefault();
            setSearchVisible(true);
            // Delay focus to ensure input is rendered
            setTimeout(() => {
                if (searchInputRef.current) {
                    searchInputRef.current.focus();
                }
            }, 10);
        } else if (e.key === 'Escape' && searchVisible) {
            setSearchVisible(false);
            clearSearchHighlights();
        }
    }, [searchVisible]);

    // Clear search highlights
    const clearSearchHighlights = useCallback(() => {
        // Remove search highlights from text layer
        const textLayer = textLayerRef.current;
        if (textLayer) {
            const highlights = textLayer.querySelectorAll('.search-highlight, .current-match'); // Select both types
            highlights.forEach(highlight => {
                // If the highlight is wrapping text, unwrap it (restore original)
                if (highlight.parentNode && highlight.firstChild && highlight.firstChild.nodeType === Node.TEXT_NODE) {
                     // Replace the highlight span with its text content
                     highlight.parentNode.replaceChild(document.createTextNode(highlight.textContent), highlight);
                } else {
                     // If it's somehow an empty highlight or structure changed, just remove it
                     highlight.remove();
                }
            });
             // Normalize the text layer after removing highlights to merge adjacent text nodes
             textLayer.normalize();
        }
        // DO NOT reset state here. State should be managed by the calling function.
        // setSearchResults([]);  <-- REMOVED
        // setCurrentResultIndex(-1); <-- REMOVED
    }, []);

    // Fetches text content for all pages
    const fetchAllPagesText = useCallback(async () => {
        if (!pdf) return [];
        const numPages = pdf.numPages;
        const promises = [];
        console.log(`Fetching text for ${numPages} pages...`);
        for (let i = 1; i <= numPages; i++) {
            // Add a catch block for individual page errors
            promises.push(
                pdf.getPage(i)
                   .then(page => page.getTextContent())
                   .catch(error => {
                       console.error(`Error fetching text content for page ${i}:`, error);
                       return null; // Return null for failed pages
                   })
            );
        }
        // Return an array where each element is { pageNumber, textContent }
        const allTextContents = await Promise.all(promises);
        console.log("Finished fetching text for all pages.");
        // Filter out any null results from failed pages
        return allTextContents
            .map((textContent, index) => (textContent ? {
                pageNumber: index + 1,
                textContent: textContent
            } : null))
            .filter(Boolean);
    }, [pdf]);

    // Highlight a search result in the text layer for the *currently rendered page*
    const highlightSearchResult = useCallback((result, index, currentMatches) => {
        if (!result) {
            console.warn("highlightSearchResult called with invalid result");
            return;
        }
        // Ensure we are on the correct page before highlighting
        if (result.pageNumber !== currentPage) {
            console.log(`Highlight request for page ${result.pageNumber}, but currently on page ${currentPage}. Skipping highlight.`);
            return; // Don't highlight if not on the correct page
        }

        console.log(`Highlighting search result ${index + 1} of ${currentMatches.length} on page ${currentPage}`);
        
        // Clear previous visual highlights from the current page only
        clearSearchHighlights(); 

        const textLayer = textLayerRef.current;
        if (!textLayer) {
            console.error("Text layer not found for highlighting on page", currentPage);
            return;
        }

        // Find the specific text item based on the itemIndex stored in the match
        const targetItemElement = textLayer.querySelectorAll('.pdf-text')[result.itemIndex];

        if (!targetItemElement) {
            console.error(`Could not find text item with index ${result.itemIndex} on page ${currentPage} to highlight.`);
            return;
        }

        // Mark all matching elements *on the current page* with highlights
        currentMatches.forEach((match, i) => {
            // Only highlight if the match is on the current page
            if (match.pageNumber === currentPage) {
                const itemElement = textLayer.querySelectorAll('.pdf-text')[match.itemIndex];
                if (itemElement) {
                    const text = itemElement.textContent; 
                    const foundIndex = match.startIndex;
                    const matchText = match.text;

                    // Create parts: before match, match, after match
                    const beforeMatch = text.substring(0, foundIndex);
                    const matchSpanText = text.substring(foundIndex, foundIndex + matchText.length);
                    const afterMatch = text.substring(foundIndex + matchText.length);

                    // Replace the content with highlighted version
                    itemElement.innerHTML = ''; // Clear existing content

                    if (beforeMatch) {
                        itemElement.appendChild(document.createTextNode(beforeMatch));
                    }

                    const highlightSpan = document.createElement('span');
                    highlightSpan.className = i === index ? 'search-highlight current-match' : 'search-highlight';
                    highlightSpan.textContent = matchSpanText; // Use the text extracted during search
                    itemElement.appendChild(highlightSpan);

                    if (afterMatch) {
                        itemElement.appendChild(document.createTextNode(afterMatch));
                    }
                } else {
                     console.warn(`Could not find item ${match.itemIndex} on page ${currentPage} during highlighting loop.`);
                }
            }
        });

        // Scroll the current result into view if it's the one we are focused on
        if (index >= 0 && result.pageNumber === currentPage) {
            const currentHighlight = textLayer.querySelector('.current-match');
            if (currentHighlight) {
                // Scroll into view logic (simplified)
                currentHighlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
                console.log("Scrolled current match into view.");
            } else {
                console.warn("Could not find .current-match element to scroll to.");
            }
        }

        // Note: setCurrentResultIndex is handled by the calling function (navigateToMatch)
    }, [clearSearchHighlights, currentPage]); // Depends on currentPage now

    // Navigate to a specific match index, changing page if necessary
    const navigateToMatch = useCallback((index, matchesToUse) => {
        if (!matchesToUse || matchesToUse.length === 0 || index < 0 || index >= matchesToUse.length) {
            console.log("Invalid index or no matches for navigateToMatch");
            setCurrentResultIndex(-1);
            clearSearchHighlights(); // Clear visuals if navigation fails
            return;
        }

        const match = matchesToUse[index];
        console.log(`Navigating to match ${index + 1}/${matchesToUse.length} on page ${match.pageNumber}`);
        
        setCurrentResultIndex(index); // Update the index state immediately for UI feedback

        if (match.pageNumber !== currentPage) {
            console.log(`Match is on page ${match.pageNumber}, changing page from ${currentPage}`);
            // Change the page state. The highlighting will happen in the useEffect hook watching currentPage.
            handlePageChange(match.pageNumber);
            // Highlighting will be triggered by the page change effect
        } else {
            console.log(`Match is on the current page (${currentPage}). Highlighting directly.`);
            // Match is on the current page, highlight immediately
            highlightSearchResult(match, index, matchesToUse);
        }
    }, [currentPage, handlePageChange, highlightSearchResult, clearSearchHighlights]); // Add dependencies

    // Perform search across the entire document
    const searchEntireDocument = useCallback(async () => {
        console.log('Searching entire document for:', searchQuery, 'Case sensitive:', matchCase);
        if (!pdf || !searchQuery.trim()) {
            clearSearchHighlights();
            setSearchResults([]);
            setCurrentResultIndex(-1);
            return;
        }

        setIsSearching(true);
        clearSearchHighlights();
        setSearchResults([]); 
        setCurrentResultIndex(-1);

        try {
            const allPagesData = await fetchAllPagesText();
            if (allPagesData.length === 0 && pdf.numPages > 0) {
                 console.error("Failed to fetch text content for any page.");
                 throw new Error("Could not fetch text content");
            }
            console.log(`Fetched text data for ${allPagesData.length} pages.`);

            const matches = [];
            const term = matchCase ? searchQuery : searchQuery.toLowerCase();

            allPagesData.forEach(pageData => {
                const { pageNumber, textContent } = pageData;
                textContent.items.forEach((item, itemIndex) => {
                    const text = item.str;
                    if (!text) return;
                    const searchableText = matchCase ? text : text.toLowerCase();

                    let startIndex = 0;
                    let foundIndex;
                    while ((foundIndex = searchableText.indexOf(term, startIndex)) !== -1) {
                        matches.push({
                            pageNumber: pageNumber,
                            itemIndex: itemIndex, 
                            text: text.substring(foundIndex, foundIndex + term.length),
                            fullItemText: text, 
                            startIndex: foundIndex, 
                        });
                        startIndex = foundIndex + 1;
                    }
                });
            });

            console.log(`Found ${matches.length} total matches for "${searchQuery}" across all pages.`);
            setSearchResults(matches); // Set the state with ALL matches

            if (matches.length > 0) {
                navigateToMatch(0, matches); // Navigate to the first match
                console.log('Navigating to first match after search.');
            } else {
                setCurrentResultIndex(-1); // Ensure index is -1 if no matches
                console.log('No matches found in the document.');
                clearSearchHighlights(); // Clear any lingering visual highlights
            }
        } catch (error) {
            console.error('Error searching entire PDF:', error);
            setSearchResults([]);
            setCurrentResultIndex(-1);
        } finally {
            setIsSearching(false);
        }
    }, [pdf, searchQuery, matchCase, clearSearchHighlights, fetchAllPagesText, navigateToMatch]); // Added navigateToMatch dependency

    // Navigate to next or previous search result
    const navigateSearchResult = useCallback((direction) => {
        if (searchResults.length === 0) {
            console.log("Navigate search result called with no results.");
            return;
        }
        
        let newIndex;
        if (direction === 'next') {
            newIndex = (currentResultIndex + 1) % searchResults.length;
        } else {
            // Handle wrapping correctly for previous
            newIndex = (currentResultIndex - 1 + searchResults.length) % searchResults.length;
        }
        
        console.log(`Navigating search results: direction=${direction}, newIndex=${newIndex}`);
        navigateToMatch(newIndex, searchResults); // Use the unified navigation function
    }, [searchResults, currentResultIndex, navigateToMatch]); // Added navigateToMatch dependency

    // Effect to handle highlighting *after* a page change initiated by search navigation
    useEffect(() => {
        // Only run this effect if search results exist and the currentResultIndex is valid
        if (searchResults.length > 0 && currentResultIndex >= 0) {
            const targetMatch = searchResults[currentResultIndex];
            // If the target match is on the *now* current page, highlight it
            if (targetMatch.pageNumber === currentPage) {
                // Add a delay to allow page transition animation to potentially finish
                const highlightDelay = 200; // ms delay (adjust if needed)
                console.log(`Scheduling highlight for match ${currentResultIndex + 1} on page ${currentPage} after ${highlightDelay}ms delay.`);
                
                const timerId = setTimeout(() => {
                    console.log(`Executing delayed highlight for match ${currentResultIndex + 1} on page ${currentPage}.`);
                    // Ensure the component hasn't unmounted or state changed drastically
                    if (pdf && searchResults.length > 0 && currentResultIndex >= 0 && searchResults[currentResultIndex]?.pageNumber === currentPage) {
                        highlightSearchResult(targetMatch, currentResultIndex, searchResults);
                    }
                }, highlightDelay);

                // Cleanup function for the timeout if dependencies change before it fires
                return () => clearTimeout(timerId);
            }
        }
        // Intentionally not clearing highlights here, as page change implies a new context
    }, [pdf, currentPage, searchResults, currentResultIndex, highlightSearchResult]); // Added pdf dependency for safety check

    // Update the useEffect hook that triggers the search based on query changes
    useEffect(() => {
        // Debounced search initiation
        const handler = setTimeout(() => {
            if (searchQuery.trim().length > 0 && pdf) {
                console.log("Search trigger effect running due to query/pdf/matchCase change.");
                searchEntireDocument(); // Call the search function
            } else {
                // If query is cleared, reset everything
                console.log("Search trigger effect clearing results due to empty query.");
                clearSearchHighlights();
                setSearchResults([]);
                setCurrentResultIndex(-1);
            }
        }, 300); // 300ms debounce

        return () => {
            clearTimeout(handler);
        };
    // Only depend on the actual search inputs. The functions called inside 
    // will use their latest versions due to useCallback.
    }, [searchQuery, pdf, matchCase]); // <-- CORRECTED DEPENDENCIES

    // Add event listener for search keyboard shortcut
    useEffect(() => {
        window.addEventListener('keydown', handleSearchKeyDown);
        return () => {
            window.removeEventListener('keydown', handleSearchKeyDown);
        };
    }, [handleSearchKeyDown]);

    // Add an effect to handle clicks outside the text selection menu
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setMenuPosition(null);
                setShowHighlightPalette(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [menuRef]);

    // Handle navigation to library
    const handleLibraryClick = useCallback(() => {
        navigate('/#library');
    }, [navigate]);

    // Add a function to handle the explain button click
    const handleExplainSelection = useCallback(() => {
        if (currentSelection && selectedText) {
            // Temporarily highlight the selected text with a special "explain" color
            const explainHighlight = {
                ...currentSelection,
                color: 'rgba(66, 135, 245, 0.4)', // Brighter blue color for explain highlights
                id: 'explain-temp-' + Date.now(),
                isTemporary: true,  // Mark as temporary
                isExplain: true,    // Mark as an explain highlight
                expireAt: Date.now() + 8000  // Expire after 8 seconds (longer duration)
            };
            
            // Add a pulsing effect class to the explain highlight
            setTimeout(() => {
                const explainElements = document.querySelectorAll(`.highlight[data-highlight-id="${explainHighlight.id}"]`);
                explainElements.forEach(el => {
                    el.classList.add('explain-pulse');
                });
            }, 100);
            
            // Add to highlights array
            setHighlights(prev => [...prev, explainHighlight]);
            
            // Close the selection menu
            setMenuPosition(null);
            
            // Send the selection to the chat window for explanation
            // This will abort any previous chat stream that was in progress
            if (chatWindowRef.current) {
                chatWindowRef.current.explainSelection(selectedText);
            }
            
            // Clear the current selection
            setCurrentSelection(null);
            setSelectedText('');
            
            // Remove the temporary highlight after 8 seconds
            setTimeout(() => {
                setHighlights(prev => prev.filter(h => h.id !== explainHighlight.id));
            }, 8000);
        }
    }, [currentSelection, selectedText]);

    // Add a useEffect hook to adjust text layer when zooming or resizing
    useEffect(() => {
        // Fix text layer offset after any zoom changes or window resize
        if (textLayerRef.current) {
            removeTextLayerOffset(textLayerRef.current);
        }
        
        const handleResize = () => {
            if (textLayerRef.current) {
                removeTextLayerOffset(textLayerRef.current);
            }
        };
        
        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, [scale]); // Re-run when scale changes

    return (
        <div className="pdf-viewer-page">
            <div className="pdf-viewer-container">
                <div 
                    className={`pdf-controls ${controlsVisible ? 'visible' : 'hidden'}`}
                    ref={controlsRef}
                    onMouseEnter={() => {
                        if (scrollTimeoutRef.current) {
                            clearTimeout(scrollTimeoutRef.current);
                        }
                        setControlsVisible(true);
                    }}
                    onMouseLeave={() => {
                        // Don't auto-hide when mouse leaves, let scroll detection handle it
                    }}
                    style={{
                        left: '32%',
                        transform: 'translateX(-50%)'
                    }}
                >
                    <div className="library-button" onClick={handleLibraryClick}>
                        <span className="material-icons">menu_book</span>
                        <span>Library</span>
                    </div>
                    
                    <div className="zoom-controls">
                        <button onClick={() => handleZoom(-1)} disabled={zoomIndex === 0}>
                            <span className="material-icons">remove</span>
                        </button>
                        <span className="zoom-icon material-icons">zoom_in</span>
                        <input
                            type="text"
                            className="zoom-input"
                            value={customZoom}
                            onChange={handleCustomZoomChange}
                            onKeyDown={handleCustomZoomSubmit}
                            onBlur={handleCustomZoomSubmit}
                            aria-label="Zoom percentage"
                        />
                        <span className="zoom-percentage">%</span>
                        <button onClick={() => handleZoom(1)} disabled={zoomIndex === ZOOM_LEVELS.length - 1}>
                            <span className="material-icons">add</span>
                        </button>
                    </div>

                    <div className="navigation-group">
                        <button onClick={() => changePage(-1)} disabled={currentPage <= 1}>
                            <span className="material-icons">navigate_before</span>
                        </button>
                        
                        <form onSubmit={handlePageInputSubmit} className="page-input-form">
                            <input
                                type="text"
                                value={pageInputValue}
                                onChange={handlePageInputChange}
                                onBlur={handlePageInputSubmit}
                                className="page-number-input"
                                aria-label="Page number"
                            />
                            <span className="page-input-separator">of {totalPages}</span>
                        </form>
                        
                        <button onClick={() => changePage(1)} disabled={currentPage >= totalPages}>
                            <span className="material-icons">navigate_next</span>
                        </button>
                    </div>
                    
                    <button 
                        className="search-button"
                        onClick={() => {
                            setSearchVisible(true);
                            setTimeout(() => {
                                if (searchInputRef.current) {
                                    searchInputRef.current.focus();
                                }
                            }, 10);
                        }}
                        title="Search in document (Ctrl+F)"
                    >
                        <span className="material-icons">search</span>
                    </button>
                    
                    <div className="pdf-highlight">
                        <button
                            className="highlight-button"
                            onClick={() => setShowHighlightPalette(!showHighlightPalette)}
                            title="Highlight text"
                        >
                            <span className="material-icons">format_color_text</span>
                        </button>
                        {showHighlightPalette && (
                            <div className="highlight-color-palette">
                                <input 
                                    type="color" 
                                    className="color-picker"
                                    onChange={(e) => handleHighlightSelection(e.target.value)}
                                    defaultValue="#FFFF00"
                                />
                            </div>
                        )}
                    </div>
                    
                    {currentSectionTitle && (
                        <div className="current-section-title" title={currentSectionTitle}>
                            <span className="material-icons">bookmark</span>
                            <span className="section-title-text">{currentSectionTitle}</span>
                        </div>
                    )}
                </div>

                {/* Add search component */}
                {searchVisible && (
                    <div className="pdf-search-container">
                        <div className="pdf-search">
                            <div className="search-input-container">
                                <span className="material-icons search-icon">search</span>
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search in document"
                                    className="search-input"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            navigateSearchResult('next');
                                        } else if (e.key === 'Escape') {
                                            setSearchVisible(false);
                                            clearSearchHighlights();
                                        }
                                    }}
                                />
                                {isSearching && (
                                    <span className="material-icons search-loading">sync</span>
                                )}
                                {!isSearching && searchQuery && (
                                    <button 
                                        className="search-clear-button"
                                        onClick={() => {
                                            setSearchQuery('');
                                            clearSearchHighlights();
                                        }}
                                    >
                                        <span className="material-icons">close</span>
                                    </button>
                                )}
                            </div>

                            <div className="search-controls">
                                <label className="match-case-label">
                                    <input
                                        type="checkbox"
                                        checked={matchCase}
                                        onChange={(e) => setMatchCase(e.target.checked)}
                                    />
                                    <span>Match case</span>
                                </label>

                                <span className="search-results-count">
                                    {searchResults.length > 0 ? 
                                        `${currentResultIndex + 1} of ${searchResults.length}` :
                                        searchQuery ? 'No results' : ''
                                    }
                                </span>

                                <div className="search-buttons">
                                    <button 
                                        className="search-nav-button"
                                        onClick={() => navigateSearchResult('prev')}
                                        disabled={searchResults.length === 0}
                                    >
                                        <span className="material-icons">keyboard_arrow_up</span>
                                    </button>
                                    <button 
                                        className="search-nav-button"
                                        onClick={() => navigateSearchResult('next')}
                                        disabled={searchResults.length === 0}
                                    >
                                        <span className="material-icons">keyboard_arrow_down</span>
                                    </button>
                                    <button 
                                        className="search-close-button"
                                        onClick={() => {
                                            setSearchVisible(false);
                                            clearSearchHighlights();
                                        }}
                                    >
                                        <span className="material-icons">close</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                
                <div
                    className={`pdf-content ${tocCollapsed ? 'toc-collapsed' : ''}`}
                >
                    {/* Add hover detection area at the bottom */}
                    <div 
                        className="controls-hover-area" 
                        onMouseEnter={() => {
                            if (scrollTimeoutRef.current) {
                                clearTimeout(scrollTimeoutRef.current);
                            }
                            setControlsVisible(true);
                        }}
                    ></div>
                    
                    <ResizablePanel
                        width={tocCollapsed ? 48 : indexWidth}
                        minWidth={tocCollapsed ? 48 : 100}
                        maxWidth={tocCollapsed ? 48 : 400}
                        onResize={(width) => {
                            if (!tocCollapsed) {
                                setIndexWidth(width);
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
                                setTocCollapsed(!isExpanded);
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
                        onWheel={handleWheel}
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                    >
                        {isLoading ? (
                            <div className="loading">Loading PDF...</div>
                        ) : error ? (
                            <div className="error-message">{error}</div>
                        ) : (
                            <div className="page-transition-wrapper">
                                {/* Add scroll resistance indicator */}
                                {scrollIndicator.visible && (
                                    <div className={`scroll-resistance-indicator ${scrollIndicator.direction}`}>
                                        <div className="resistance-progress"></div>
                                        <span>{scrollIndicator.direction === 'next' ? 'Keep scrolling to next page' : 'Keep scrolling to previous page'}</span>
                                    </div>
                                )}
                                <div className={`pdf-page-container ${pageTransition}`}
                                     style={{
                                         transformOrigin: transitionDirection === 'next' ? 'left center' : 'right center'
                                     }}
                                >
                                    <canvas ref={viewerRef} />
                                    <div
                                        ref={textLayerRef}
                                        className="text-layer"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <ResizablePanel
                        width={chatWidth}
                        minWidth={250}
                        maxWidth={tocCollapsed ? 700 : 600}
                        onResize={(width) => {
                            setChatWidth(width);
                            setPreviousChatWidth(width);
                        }}
                        position="right"
                    >
                        <div className="right-panel">
                            <ChatWindow
                                ref={chatWindowRef}
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
            {menuPosition && selectedText && (
                <div className="text-selection-menu" ref={menuRef}>
                     <button className="selection-menu-button explain-button" onClick={handleExplainSelection}>
                         <span className="material-icons">psychology</span>
                         <span>Explain</span>
                     </button>
                     <button className="selection-menu-button highlight-button" onClick={() => setShowHighlightPalette(true)}>
                         <span className="material-icons">highlight</span>
                         <span>Highlight</span>
                     </button>
                </div>
            )}
            {showHighlightPalette && menuPosition && (
                <div className="highlight-palette">
                     <div onClick={() => handleHighlightSelection('rgba(255, 255, 0, 0.3)')} style={{ backgroundColor: 'rgba(255, 255, 0, 0.3)' }} className="highlight-color"></div>
                     <div onClick={() => handleHighlightSelection('rgba(144, 238, 144, 0.3)')} style={{ backgroundColor: 'rgba(144, 238, 144, 0.3)' }} className="highlight-color"></div>
                     <div onClick={() => handleHighlightSelection('rgba(173, 216, 230, 0.3)')} style={{ backgroundColor: 'rgba(173, 216, 230, 0.3)' }} className="highlight-color"></div>
                     <div onClick={() => handleHighlightSelection('rgba(255, 182, 193, 0.3)')} style={{ backgroundColor: 'rgba(255, 182, 193, 0.3)' }} className="highlight-color"></div>
                     <div onClick={() => handleHighlightSelection('rgba(255, 165, 0, 0.3)')} style={{ backgroundColor: 'rgba(255, 165, 0, 0.3)' }} className="highlight-color"></div>
                </div>
            )}
            <style jsx>{`
                .scroll-resistance-indicator {
                    position: absolute;
                    width: 240px;
                    height: 40px;
                    background: rgba(255, 255, 255, 0.95);
                    border-radius: 20px;
                    z-index: 100;
                    opacity: 0.95;
                    transition: opacity 0.3s ease;
                    left: 50%;
                    transform: translateX(-50%);
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    padding: 0 15px;
                    border: 1px solid rgba(0, 0, 0, 0.08);
                }
                
                .scroll-resistance-indicator.next {
                    bottom: 20px;
                }
                
                .scroll-resistance-indicator.prev {
                    top: 20px;
                }
                
                .resistance-progress {
                    height: 4px;
                    width: 100%;
                    background: rgba(0, 0, 0, 0.1);
                    border-radius: 3px;
                    overflow: hidden;
                    margin-bottom: 8px;
                }
                
                .resistance-progress::after {
                    content: '';
                    display: block;
                    height: 100%;
                    width: ${scrollIndicator.progress}%;
                    background: linear-gradient(90deg, #2196F3, #1976D2);
                    border-radius: 3px;
                    transition: width 0.15s cubic-bezier(0.4, 0, 0.2, 1);
                }
                
                .scroll-resistance-indicator span {
                    font-size: 13px;
                    color: #333;
                    font-weight: 500;
                    text-align: center;
                    white-space: nowrap;
                    display: flex;
                    align-items: center;
                }
                
                .scroll-resistance-indicator span::before {
                    content: '';
                    display: inline-block;
                    width: 18px;
                    height: 18px;
                    margin-right: 8px;
                    background-position: center;
                    background-repeat: no-repeat;
                    background-size: contain;
                    opacity: 0.7;
                }
                
                .scroll-resistance-indicator.next span::before {
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' height='18' viewBox='0 -960 960 960' width='18' fill='%23333'%3E%3Cpath d='M480-344 240-584l56-56 184 184 184-184 56 56-240 240Z'/%3E%3C/svg%3E");
                    transform: rotate(180deg);
                }
                
                .scroll-resistance-indicator.prev span::before {
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' height='18' viewBox='0 -960 960 960' width='18' fill='%23333'%3E%3Cpath d='M480-344 240-584l56-56 184 184 184-184 56 56-240 240Z'/%3E%3C/svg%3E");
                }
                
                /* Add styles for the new page input form */
                .page-input-form {
                    display: flex;
                    align-items: center;
                    margin: 0 5px;
                }
                
                .page-number-input {
                    width: 40px;
                    height: 28px;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                    text-align: center;
                    font-size: 14px;
                    padding: 0 4px;
                    margin-right: 4px;
                }
                
                .page-input-separator {
                    font-size: 14px;
                    white-space: nowrap;
                }
                
                /* Add styles for current section indicator */
                .current-section-title {
                    display: flex;
                    align-items: center;
                    max-width: 300px;
                    overflow: hidden;
                    white-space: nowrap;
                    background-color: rgba(255, 255, 255, 0.9);
                    padding: 4px 10px;
                    border-radius: 16px;
                    margin-left: 10px;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                }
                
                .current-section-title .material-icons {
                    font-size: 16px;
                    margin-right: 5px;
                    color: #1976D2;
                }
                
                .section-title-text {
                    overflow: hidden;
                    text-overflow: ellipsis;
                    font-size: 13px;
                    font-weight: 500;
                }
                
                /* Update PDF controls for better layout */
                .pdf-controls {
                    display: flex;
                    flex-wrap: wrap;
                    align-items: center;
                    gap: 10px;
                    padding: 10px 15px;
                    border-radius: 8px;
                }
                
                @media (max-width: 768px) {
                    .current-section-title {
                        display: none;
                    }
                    
                    .pdf-controls {
                        justify-content: center;
                    }
                }

                /* Add search styling */
                .pdf-search-container {
                    position: absolute;
                    top: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    z-index: 100;
                    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
                    border-radius: 8px;
                    background-color: #ffffff;
                    width: 380px;
                    overflow: hidden;
                    animation: slide-in 0.15s ease;
                    border: 1px solid #e0e0e0;
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
                }
                
                @keyframes slide-in {
                    from { opacity: 0; transform: translateY(-10px) translateX(-50%); }
                    to { opacity: 1; transform: translateY(0) translateX(-50%); }
                }
                
                .pdf-search {
                    padding: 12px;
                }
                
                .search-input-container {
                    position: relative;
                    display: flex;
                    align-items: center;
                    margin-bottom: 8px;
                }
                
                .search-icon {
                    position: absolute;
                    left: 10px;
                    color: #666666;
                    font-size: 20px;
                }
                
                .search-loading {
                    position: absolute;
                    right: 10px;
                    color: #666666;
                    font-size: 18px;
                    animation: spin 1s linear infinite;
                }
                
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                
                .search-input {
                    width: 100%;
                    height: 36px;
                    padding: 8px 36px 8px 36px;
                    border: 1px solid #e0e0e0;
                    border-radius: 4px;
                    font-size: 14px;
                    outline: none;
                    transition: border-color 0.2s;
                }
                
                .search-input:focus {
                    border-color: #2196F3;
                    box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.15);
                }
                
                .search-clear-button {
                    position: absolute;
                    right: 8px;
                    background: none;
                    border: none;
                    color: #666666;
                    padding: 0;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 20px;
                    height: 20px;
                }
                
                .search-clear-button:hover {
                    color: #333333;
                }
                
                .search-controls {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }
                
                .match-case-label {
                    display: flex;
                    align-items: center;
                    font-size: 13px;
                    color: #444444;
                    cursor: pointer;
                }
                
                .match-case-label input {
                    margin-right: 6px;
                }
                
                .search-results-count {
                    font-size: 13px;
                    color: #555555;
                }
                
                .search-buttons {
                    display: flex;
                    align-items: center;
                }
                
                .search-nav-button, .search-close-button {
                    background: none;
                    border: none;
                    width: 30px;
                    height: 30px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #444444;
                    cursor: pointer;
                    border-radius: 4px;
                    margin-left: 4px;
                }
                
                .search-nav-button:hover, .search-close-button:hover {
                    background-color: #f5f5f5;
                    color: #000000;
                }
                
                .search-nav-button:disabled {
                    color: #cccccc;
                    cursor: default;
                }
                
                .search-nav-button:disabled:hover {
                    background-color: transparent;
                }
                
                .search-close-button {
                    margin-left: 8px;
                }
                
                /* Highlight styling */
                .search-highlight {
                    background-color: rgba(255, 230, 0, 0.4); /* yellow highlight */
                    border-radius: 2px;
                    box-shadow: 0 0 0 1px rgba(255, 210, 0, 0.5);
                }
                
                /* Current match styling - make it stand out more */
                .current-match {
                    background-color: rgba(255, 165, 0, 0.5); /* orange highlight */
                    box-shadow: 0 0 0 1px rgba(255, 140, 0, 0.6);
                }
                
                .scroll-resistance-indicator.next {
                    bottom: 20px;
                }
                
                .scroll-resistance-indicator.prev {
                    top: 20px;
                }
                
                .page-input-form {
                    display: flex;
                    align-items: center;
                    margin: 0 5px;
                }
                
                .page-number-input {
                    width: 40px;
                    height: 28px;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                    text-align: center;
                    font-size: 14px;
                    padding: 0 4px;
                    margin-right: 4px;
                }
                
                .page-input-separator {
                    font-size: 14px;
                    white-space: nowrap;
                }
                
                /* Add styling for search button */
                .search-button {
                    background-color: #f5f5f5;
                    border: 1px solid #e0e0e0;
                    border-radius: 4px;
                    padding: 4px 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    color: #444;
                    transition: all 0.2s ease;
                    margin-left: 10px;
                    height: 30px;
                }
                
                .search-button:hover {
                    background-color: #e8e8e8;
                    border-color: #d0d0d0;
                }
                
                .search-button .material-icons {
                    font-size: 18px;
                }

                /* Selection menu styling */
                .text-selection-menu {
                    position: absolute;
                    top: ${menuPosition?.y}px;
                    left: ${menuPosition?.x}px;
                    z-index: 2000;
                    background: white;
                    border-radius: 6px;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
                    display: flex;
                    gap: 6px;
                    padding: 6px;
                    animation: fade-in 0.2s ease;
                    border: 1px solid rgba(0, 0, 0, 0.1);
                }
                
                @keyframes fade-in {
                    from { opacity: 0; transform: translateY(5px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                
                .selection-menu-button {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    padding: 6px 10px;
                    border: none;
                    border-radius: 4px;
                    background: #f5f5f5;
                    color: #333;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                
                .selection-menu-button:hover {
                    background: #ebebeb;
                }
                
                .selection-menu-button .material-icons {
                    font-size: 16px;
                }
                
                .explain-button {
                    background: #e3f2fd;
                    color: #0d47a1;
                }
                
                .explain-button:hover {
                    background: #bbdefb;
                }
                
                .highlight-button {
                    background: #fff8e1;
                    color: #ff8f00;
                }
                
                .highlight-button:hover {
                    background: #ffecb3;
                }
                
                /* Highlight palette styling */
                .highlight-palette {
                    position: absolute;
                    top: ${menuPosition?.y + 40}px;
                    left: ${menuPosition?.x}px;
                    z-index: 2000;
                    background: white;
                    border-radius: 6px;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
                    display: flex;
                    gap: 8px;
                    padding: 8px;
                    animation: fade-in 0.2s ease;
                    border: 1px solid rgba(0, 0, 0, 0.1);
                }
                
                .highlight-color {
                    width: 24px;
                    height: 24px;
                    border-radius: 12px;
                    cursor: pointer;
                    transition: transform 0.15s ease;
                    border: 1px solid rgba(0, 0, 0, 0.1);
                }
                
                .highlight-color:hover {
                    transform: scale(1.15);
                }

                /* Library button styles */
                .library-button {
                    display: flex;
                    align-items: center;
                    background-color:rgb(120, 171, 253);
                    background: linear-gradient(45deg, #60a5fa,rgb(112, 165, 249));
                    border: none;
                    border-radius: 24px;
                    color: white;
                    padding: 8px 15px;
                    font-size: 14px;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
                    letter-spacing: 0.5px;
                    position: relative;
                    overflow: hidden;
                    margin-right: 10px;
                }

                .library-button:hover {
                    background: linear-gradient(45deg, #3b82f6,rgb(52, 111, 240));
                    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
                    transform: translateY(-2px);
                }

                .library-button:active {
                    background-color:rgb(46, 106, 237);
                    transform: translateY(0);
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                }

                .library-button span {
                    position: relative;
                    z-index: 1;
                    color: white;
                }

                .library-button .material-icons {
                    margin-right: 8px;
                    color: white;
                    font-size: 18px;
                }

                /* Highlight container and delete button styling */
                .highlight-container {
                    position: absolute;
                }
                
                .highlight-container:hover .highlight-delete-button {
                    opacity: 1;
                    transform: scale(1);
                }
                
                .highlight-delete-button {
                    position: absolute;
                    top: -10px;
                    right: -10px;
                    width: 20px;
                    height: 20px;
                    background-color: #ff5252;
                    color: white;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 16px;
                    font-weight: bold;
                    cursor: pointer;
                    z-index: 100;
                    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
                    opacity: 0.3;
                    transform: scale(0.8);
                    transition: opacity 0.2s ease, transform 0.2s ease, background-color 0.2s ease;
                    line-height: 1;
                    user-select: none;
                    border: 1.5px solid white;
                }
                
                .highlight-delete-button:hover {
                    background-color: #ff1744;
                    transform: scale(1.1) !important;
                }

                /* Add animation for explain highlight */
                @keyframes explain-pulse {
                    0% {
                        box-shadow: 0 0 0 0 rgba(66, 135, 245, 0.6);
                        background-color: rgba(66, 135, 245, 0.4);
                    }
                    70% {
                        box-shadow: 0 0 0 8px rgba(66, 135, 245, 0);
                        background-color: rgba(66, 135, 245, 0.6);
                    }
                    100% {
                        box-shadow: 0 0 0 0 rgba(66, 135, 245, 0);
                        background-color: rgba(66, 135, 245, 0.4);
                    }
                }
                
                .explain-pulse {
                    animation: explain-pulse 1.5s infinite;
                    border-radius: 3px;
                }
            `}</style>
        </div>
    );
}
