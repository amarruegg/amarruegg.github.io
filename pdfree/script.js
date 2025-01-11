// Initialize state variables
let pdfDoc = null;
let currentPage = 1;
let scale = 1.0;
let pageMarkups = new Map();
let zoomLevels = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
let currentZoomIndex = 2; // Start at 100%
let isDrawing = false;
let currentTool = 'select';
let markupColor = '#ff0000';
let drawPoints = [];
let activeMarkupLayer = null;
let selectedMarkup = null;
let isMoving = false;
let isResizing = false;
let moveOffset = { x: 0, y: 0 };
let resizeHandle = null;
let originalAspectRatio = null;
let originalFontSize = null;
let wasMovingOrResizing = false;

// Search state
let searchResults = [];
let currentSearchIndex = -1;
let searchText = '';
let searchActive = false;

// Global references
let signaturePad;
let signatureCanvas;
let signatureCtx;

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeUI();
    setupSearchHandlers();
});

// Search functionality
function setupSearchHandlers() {
    // Keyboard shortcut for search
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            toggleSearch(true);
        }
        if (e.key === 'Escape' && searchActive) {
            toggleSearch(false);
        }
    });

    // Search controls
    const searchBar = document.querySelector('.search-bar');
    const searchInput = searchBar.querySelector('.search-input');
    const prevBtn = document.getElementById('prevMatch');
    const nextBtn = document.getElementById('nextMatch');
    const closeBtn = document.getElementById('closeSearch');

    searchInput.addEventListener('input', handleSearch);
    prevBtn.addEventListener('click', () => navigateSearch('prev'));
    nextBtn.addEventListener('click', () => navigateSearch('next'));
    closeBtn.addEventListener('click', () => toggleSearch(false));
}

function toggleSearch(show) {
    const searchBar = document.querySelector('.search-bar');
    const searchInput = searchBar.querySelector('.search-input');
    
    searchActive = show;
    searchBar.classList.toggle('active', show);
    
    if (show) {
        searchInput.focus();
        if (searchInput.value) {
            handleSearch({ target: searchInput });
        }
    } else {
        clearSearchHighlights();
    }
}

async function handleSearch(e) {
    searchText = e.target.value;
    if (!searchText || !pdfDoc) {
        updateSearchCount(0, 0);
        clearSearchHighlights();
        return;
    }

    searchResults = [];
    currentSearchIndex = -1;

    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
        const page = await pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();
        const text = textContent.items.map(item => item.str).join(' ');
        
        let index = -1;
        while ((index = text.toLowerCase().indexOf(searchText.toLowerCase(), index + 1)) !== -1) {
            searchResults.push({
                pageNum,
                index,
                text: text.substr(index, searchText.length)
            });
        }
    }

    updateSearchCount(searchResults.length > 0 ? 1 : 0, searchResults.length);
    if (searchResults.length > 0) {
        navigateSearch('next');
    }
}

function navigateSearch(direction) {
    if (!searchResults.length) return;

    if (direction === 'next') {
        currentSearchIndex = (currentSearchIndex + 1) % searchResults.length;
    } else {
        currentSearchIndex = currentSearchIndex <= 0 ? searchResults.length - 1 : currentSearchIndex - 1;
    }

    const result = searchResults[currentSearchIndex];
    setCurrentPage(result.pageNum);
    updateSearchCount(currentSearchIndex + 1, searchResults.length);
    highlightSearchResult(result);
}

function updateSearchCount(current, total) {
    const searchCount = document.querySelector('.search-count');
    searchCount.textContent = total > 0 ? `${current}/${total}` : '0/0';
}

function highlightSearchResult(result) {
    clearSearchHighlights();
    if (!result) return;

    const markupLayer = document.querySelector(
        `.page-container[data-page-number="${result.pageNum}"] .markup-layer`
    );
    if (!markupLayer) return;

    const markup = {
        type: 'highlight',
        x: 50, // Approximate position - would need text position data for exact location
        y: 50,
        width: 100,
        height: 20,
        color: '#ffeb3b40', // Yellow highlight
        isSearchHighlight: true
    };

    if (!pageMarkups.has(result.pageNum)) {
        pageMarkups.set(result.pageNum, []);
    }
    pageMarkups.get(result.pageNum).push(markup);
    renderMarkups(markupLayer, pageMarkups.get(result.pageNum), {});
}

function clearSearchHighlights() {
    document.querySelectorAll('.markup-layer').forEach(layer => {
        const pageNum = parseInt(layer.parentElement.dataset.pageNumber);
        if (pageMarkups.has(pageNum)) {
            const markups = pageMarkups.get(pageNum);
            const filtered = markups.filter(m => !m.isSearchHighlight);
            if (filtered.length !== markups.length) {
                pageMarkups.set(pageNum, filtered);
                renderMarkups(layer, filtered, {});
            }
        }
    });
}

function initializeUI() {
    try {
        // Get existing signature pad elements
        signaturePad = document.querySelector('.signature-pad');
        signatureCanvas = document.getElementById('signatureCanvas');
        
        if (!signaturePad) {
            console.error('Signature pad element not found');
            return;
        }
        
        if (!signatureCanvas) {
            console.error('Signature canvas element not found');
            return;
        }

        // Set canvas dimensions
        signatureCanvas.width = 400;
        signatureCanvas.height = 200;
        
        // Get canvas context
        signatureCtx = signatureCanvas.getContext('2d');
        if (!signatureCtx) {
            console.error('Failed to get canvas context');
            return;
        }

        // Set up event listeners
        setupEventListeners();
        
        // Initial UI update
        updateUI();
        
        console.log('Signature pad initialized successfully');
    } catch (error) {
        console.error('Error initializing UI:', error);
    }
}

function setupEventListeners() {
    // File input handlers
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.addEventListener('change', handleFileInput);
    }

    const pageFileInput = document.getElementById('pageFileInput');
    if (pageFileInput) {
        pageFileInput.addEventListener('change', handlePageFileInput);
    }

    // Tool buttons
    const toolButtons = document.querySelectorAll('.tool-button');
    toolButtons?.forEach(button => {
        button.addEventListener('click', handleToolButtonClick);
    });

    // Color picker
    const colorPicker = document.getElementById('markupColor');
    if (colorPicker) {
        colorPicker.addEventListener('input', (e) => {
            markupColor = e.target.value;
        });
    }

    // Clear markup button
    const clearMarkupBtn = document.getElementById('clearMarkup');
    if (clearMarkupBtn) {
        clearMarkupBtn.addEventListener('click', handleClearMarkup);
    }

    // Zoom controls
    const zoomInBtn = document.getElementById('zoomIn');
    if (zoomInBtn) {
        zoomInBtn.addEventListener('click', handleZoomIn);
    }

    const zoomOutBtn = document.getElementById('zoomOut');
    if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', handleZoomOut);
    }

    // Page manipulation buttons
    const addBlankPageBtn = document.getElementById('addBlankPage');
    if (addBlankPageBtn) {
        addBlankPageBtn.addEventListener('click', handleAddBlankPage);
    }

    const deletePageBtn = document.getElementById('deletePage');
    if (deletePageBtn) {
        deletePageBtn.addEventListener('click', handleDeletePage);
    }

    const movePageUpBtn = document.getElementById('movePageUp');
    if (movePageUpBtn) {
        movePageUpBtn.addEventListener('click', handleMovePageUp);
    }

    const movePageDownBtn = document.getElementById('movePageDown');
    if (movePageDownBtn) {
        movePageDownBtn.addEventListener('click', handleMovePageDown);
    }

    // Download button
    const downloadBtn = document.getElementById('download');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', handleDownload);
    }

    // Note: Signature pad button handlers are set up in showSignaturePad
    // since the buttons are recreated each time the signature pad is shown
}

function handleFileInput(e) {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
        const fileReader = new FileReader();
        fileReader.onload = function() {
            const typedarray = new Uint8Array(this.result);
            loadPDF(typedarray);
        };
        fileReader.readAsArrayBuffer(file);
    }
}

async function handlePageFileInput(e) {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf' && pdfDoc) {
        try {
            const fileReader = new FileReader();
            fileReader.onload = async function() {
                const typedarray = new Uint8Array(this.result);
                await mergePDF(typedarray);
            };
            fileReader.readAsArrayBuffer(file);
        } catch (error) {
            console.error('Error loading additional PDF:', error);
            alert('Error loading additional PDF file.');
        }
    }
}

async function mergePDF(newPdfData) {
    try {
        const pdfBytes = await pdfDoc.getData();
        const basePdf = await PDFLib.PDFDocument.load(pdfBytes);
        const newPdf = await PDFLib.PDFDocument.load(newPdfData);
        
        const pages = await basePdf.copyPages(newPdf, newPdf.getPageIndices());
        pages.forEach(page => {
            basePdf.insertPage(currentPage, page);
        });
        
        const mergedPdfBytes = await basePdf.save();
        loadPDF(mergedPdfBytes);
    } catch (error) {
        console.error('Error merging PDFs:', error);
        alert('Error merging PDFs.');
    }
}

async function loadPDF(data) {
    try {
        console.log('Loading PDF...');
        pdfDoc = await pdfjsLib.getDocument({data: data}).promise;
        console.log('PDF loaded, pages:', pdfDoc.numPages);
        currentPage = 1;
        await renderAllPages();
        updateUI();
    } catch (error) {
        console.error('Error loading PDF:', error);
        alert('Error loading PDF: ' + error.message);
    }
}

async function renderAllPages() {
    const container = document.querySelector('.pdf-container');
    if (!container) return;

    container.innerHTML = '';
    
    for (let i = 1; i <= pdfDoc.numPages; i++) {
        const pageContainer = document.createElement('div');
        pageContainer.className = `page-container${i === currentPage ? ' current-page' : ''}`;
        pageContainer.dataset.pageNumber = i;
        pageContainer.style.opacity = '0';
        pageContainer.style.transition = 'opacity 0.3s ease';
        
        const canvas = document.createElement('canvas');
        canvas.className = 'page-canvas';
        
        const markupLayer = document.createElement('canvas');
        markupLayer.className = 'markup-layer';
        
        const pageNumber = document.createElement('div');
        pageNumber.className = 'page-number';
        pageNumber.textContent = `Page ${i}`;
        
        pageContainer.appendChild(canvas);
        pageContainer.appendChild(markupLayer);
        pageContainer.appendChild(pageNumber);
        container.appendChild(pageContainer);
        
        await renderPage(i, canvas, markupLayer);
        
        // Fade in the page
        setTimeout(() => {
            pageContainer.style.opacity = '1';
        }, 50 * i); // Stagger the fade-in
    }
    
    container.addEventListener('click', (e) => {
        const pageContainer = e.target.closest('.page-container');
        if (pageContainer) {
            setCurrentPage(parseInt(pageContainer.dataset.pageNumber));
        }
    });
}

async function renderPage(num, canvas, markupLayer) {
    try {
        console.log(`Rendering page ${num}...`);
        const page = await pdfDoc.getPage(num);
        const viewport = page.getViewport({ scale });
        
        // Set dimensions for both canvas and container
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        markupLayer.width = viewport.width;
        markupLayer.height = viewport.height;
        canvas.parentElement.style.width = `${viewport.width}px`;
        canvas.parentElement.style.height = `${viewport.height}px`;
        
        const ctx = canvas.getContext('2d');
        const renderContext = {
            canvasContext: ctx,
            viewport: viewport,
            enableWebGL: true
        };
        
        await page.render(renderContext).promise;
        console.log(`Page ${num} rendered`);
        
        setupMarkupHandlers(markupLayer);
        
        if (pageMarkups.has(num)) {
            renderMarkups(markupLayer, pageMarkups.get(num), viewport);
        }
    } catch (error) {
        console.error('Error rendering page:', error);
        alert(`Error rendering page ${num}: ${error.message}`);
    }
}

function setupMarkupHandlers(markupLayer) {
    markupLayer.addEventListener('mousedown', handleMouseDown);
    markupLayer.addEventListener('mousemove', handleMouseMove);
    markupLayer.addEventListener('mouseup', handleMouseUp);
    markupLayer.addEventListener('mouseout', handleMouseUp);
    markupLayer.addEventListener('click', handleClick);
}

function startDrawing(e) {
    isDrawing = true;
    activeMarkupLayer = e.target;
    const point = getCanvasPoint(e);
    drawPoints = [point];
}

function draw(e) {
    if (!isDrawing || !activeMarkupLayer) return;
    
    const point = getCanvasPoint(e);
    drawPoints.push(point);
    
    const ctx = activeMarkupLayer.getContext('2d');
    ctx.beginPath();
    ctx.strokeStyle = markupColor;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(drawPoints[drawPoints.length - 2][0], drawPoints[drawPoints.length - 2][1]);
    ctx.lineTo(point[0], point[1]);
    ctx.stroke();
}

function stopDrawing(e) {
    if (!isDrawing || !activeMarkupLayer) return;
    
    isDrawing = false;
    const pageNum = parseInt(activeMarkupLayer.parentElement.dataset.pageNumber);
    
    if (!pageMarkups.has(pageNum)) {
        pageMarkups.set(pageNum, []);
    }
    
    if (drawPoints.length > 1) {
        const markup = {
            type: 'draw',
            points: drawPoints,
            color: markupColor
        };
        pageMarkups.get(pageNum).push(markup);
    }
    
    drawPoints = [];
    activeMarkupLayer = null;
}

function handleMouseDown(e) {
    const point = getCanvasPoint(e);
    const markupLayer = e.target;
    const pageNum = parseInt(markupLayer.parentElement.dataset.pageNumber);
    
    if (currentTool === 'draw') {
        startDrawing(e);
        return;
    }
    
    if (selectedMarkup && selectedMarkup.type !== 'draw') {
        const handle = getResizeHandle(point, selectedMarkup);
        if (handle) {
            isResizing = true;
            wasMovingOrResizing = true;
            resizeHandle = handle;
            originalAspectRatio = selectedMarkup.width / selectedMarkup.height;
            originalFontSize = selectedMarkup.fontSize;
            selectedMarkup._originalX = selectedMarkup.x;
            selectedMarkup._originalY = selectedMarkup.y;
            return;
        }
    }
    
    if (pageMarkups.has(pageNum)) {
        const markups = pageMarkups.get(pageNum);
        for (let i = markups.length - 1; i >= 0; i--) {
            const markup = markups[i];
            if (isPointInMarkup(point, markup)) {
                selectedMarkup = markup;
                isMoving = true;
                wasMovingOrResizing = true;
                moveOffset = {
                    x: point[0] - (markup.x || markup.points?.[0]?.[0] || 0),
                    y: point[1] - (markup.y || markup.points?.[0]?.[1] || 0)
                };
                renderMarkups(markupLayer, pageMarkups.get(pageNum), {});
                return;
            }
        }
    }
    
    selectedMarkup = null;
    if (pageMarkups.has(pageNum)) {
        renderMarkups(markupLayer, pageMarkups.get(pageNum), {});
    }
}

function handleMouseMove(e) {
    if (isDrawing) {
        draw(e);
        return;
    }
    
    const point = getCanvasPoint(e);
    const markupLayer = e.target;
    const pageNum = parseInt(markupLayer.parentElement.dataset.pageNumber);
    
    if (isResizing && selectedMarkup && selectedMarkup.type !== 'draw') {
        handleResize(point, markupLayer, pageNum);
    } else if (isMoving && selectedMarkup) {
        handleMove(point, markupLayer, pageNum);
    }
}

function handleResize(point, markupLayer, pageNum) {
    try {
        const minSize = 20;
        let newWidth;
        
        // Calculate new width based on resize handle
        if (resizeHandle === 'top-left' || resizeHandle === 'bottom-left') {
            newWidth = selectedMarkup.x + selectedMarkup.width - point[0];
        } else {
            newWidth = point[0] - selectedMarkup.x;
        }
        
        if (newWidth >= minSize) {
            if (selectedMarkup.type === 'text') {
                // For text, delegate all resizing logic to handleTextResize
                handleTextResize(newWidth, point, markupLayer);
            } else {
                // Store original values for potential rollback
                const originalX = selectedMarkup.x;
                const originalY = selectedMarkup.y;
                const originalWidth = selectedMarkup.width;
                const originalHeight = selectedMarkup.height;
                
                // Update dimensions
                const newHeight = newWidth / originalAspectRatio;
                selectedMarkup.width = newWidth;
                selectedMarkup.height = newHeight;
                
                // Update position based on resize handle
                switch (resizeHandle) {
                    case 'top-left':
                        selectedMarkup.x = point[0];
                        selectedMarkup.y = selectedMarkup.y + selectedMarkup.height - newHeight;
                        break;
                    case 'top-right':
                        selectedMarkup.y = selectedMarkup.y + selectedMarkup.height - newHeight;
                        break;
                    case 'bottom-left':
                        selectedMarkup.x = point[0];
                        break;
                    case 'bottom-right':
                        // Position stays the same
                        break;
                }
                
                // Test if the new dimensions are valid
                try {
                    const ctx = markupLayer.getContext('2d');
                    ctx.clearRect(0, 0, markupLayer.width, markupLayer.height);
                    renderMarkups(markupLayer, pageMarkups.get(pageNum), {});
                } catch (error) {
                    // Rollback changes if rendering fails
                    selectedMarkup.x = originalX;
                    selectedMarkup.y = originalY;
                    selectedMarkup.width = originalWidth;
                    selectedMarkup.height = originalHeight;
                    console.error('Error applying resize:', error);
                    
                    // Re-render with original values
                    const ctx = markupLayer.getContext('2d');
                    ctx.clearRect(0, 0, markupLayer.width, markupLayer.height);
                    renderMarkups(markupLayer, pageMarkups.get(pageNum), {});
                }
            }
        }
    } catch (error) {
        console.error('Error in handleResize:', error);
    }
}

function handleTextResize(newWidth, point, markupLayer) {
    try {
        const scale = newWidth / selectedMarkup.width;
        const newFontSize = Math.max(12, Math.round(originalFontSize * scale));
        
        const ctx = markupLayer.getContext('2d');
        ctx.font = `${newFontSize}px Arial`;
        const metrics = ctx.measureText(selectedMarkup.text);
        
        if (metrics.width > 0) {
            // Store original values for potential rollback
            const prevFontSize = selectedMarkup.fontSize;
            const prevWidth = selectedMarkup.width;
            const prevHeight = selectedMarkup.height;
            const prevX = selectedMarkup.x;
            const prevY = selectedMarkup.y;
            
            // Update dimensions first
            selectedMarkup.fontSize = newFontSize;
            selectedMarkup.width = metrics.width;
            selectedMarkup.height = newFontSize;
            
            // Handle position based on resize handle
            switch (resizeHandle) {
                case 'top-left':
                    selectedMarkup.x = prevX + prevWidth - metrics.width;
                    selectedMarkup.y = prevY + prevHeight - newFontSize;
                    break;
                case 'top-right':
                    selectedMarkup.y = prevY + prevHeight - newFontSize;
                    break;
                case 'bottom-left':
                    selectedMarkup.x = prevX + prevWidth - metrics.width;
                    break;
                case 'bottom-right':
                    // Position stays the same
                    break;
            }
            
            // Test if the new dimensions are valid
            try {
                // Clear and re-render all markups
                ctx.clearRect(0, 0, markupLayer.width, markupLayer.height);
                const pageNum = parseInt(markupLayer.parentElement.dataset.pageNumber);
                renderMarkups(markupLayer, pageMarkups.get(pageNum), {});
            } catch (error) {
                // Rollback all changes if rendering fails
                selectedMarkup.fontSize = prevFontSize;
                selectedMarkup.width = prevWidth;
                selectedMarkup.height = prevHeight;
                selectedMarkup.x = prevX;
                selectedMarkup.y = prevY;
                console.error('Error applying text resize:', error);
                
                // Re-render with original values
                ctx.clearRect(0, 0, markupLayer.width, markupLayer.height);
                const pageNum = parseInt(markupLayer.parentElement.dataset.pageNumber);
                renderMarkups(markupLayer, pageMarkups.get(pageNum), {});
            }
        }
    } catch (error) {
        console.error('Error in handleTextResize:', error);
    }
}

function handleMove(point, markupLayer, pageNum) {
    const dx = point[0] - moveOffset.x;
    const dy = point[1] - moveOffset.y;
    
    if (selectedMarkup.type === 'draw') {
        const offsetX = dx - selectedMarkup.points[0][0];
        const offsetY = dy - selectedMarkup.points[0][1];
        selectedMarkup.points = selectedMarkup.points.map(point => [
            point[0] + offsetX,
            point[1] + offsetY
        ]);
    } else {
        selectedMarkup.x = dx;
        selectedMarkup.y = dy;
    }
    
    const ctx = markupLayer.getContext('2d');
    ctx.clearRect(0, 0, markupLayer.width, markupLayer.height);
    renderMarkups(markupLayer, pageMarkups.get(pageNum), {});
}

function handleMouseUp(e) {
    if (isDrawing) {
        stopDrawing(e);
    }
    
    if (isMoving || isResizing) {
        setTimeout(() => {
            wasMovingOrResizing = false;
        }, 0);
    }
    
    if (selectedMarkup) {
        delete selectedMarkup._originalX;
        delete selectedMarkup._originalY;
    }
    
    isMoving = false;
    isResizing = false;
    resizeHandle = null;
    originalAspectRatio = null;
    originalFontSize = null;
}

function handleClick(e) {
    if (wasMovingOrResizing) {
        wasMovingOrResizing = false;
        return;
    }
    
    const markupLayer = e.target;
    const point = getCanvasPoint(e);
    const pageNum = parseInt(markupLayer.parentElement.dataset.pageNumber);
    
    switch (currentTool) {
        case 'select':
            handleSelectClick(markupLayer, point, pageNum);
            break;
        case 'text':
            handleTextClick(markupLayer, point, pageNum);
            break;
        case 'highlight':
            handleHighlightClick(markupLayer, point, pageNum);
            break;
        case 'signature':
            showSignaturePad(markupLayer, point[0], point[1]);
            break;
    }
}

function handleSelectClick(markupLayer, point, pageNum) {
    if (pageMarkups.has(pageNum)) {
        const markups = pageMarkups.get(pageNum);
        for (let i = markups.length - 1; i >= 0; i--) {
            const markup = markups[i];
            if (isPointInMarkup(point, markup)) {
                selectedMarkup = markup;
                renderMarkups(markupLayer, markups, {});
                return;
            }
        }
    }
    selectedMarkup = null;
    renderMarkups(markupLayer, pageMarkups.get(pageNum), {});
}

function handleTextClick(markupLayer, point, pageNum) {
    const text = prompt('Enter text:');
    if (!text) return;
    
    if (!pageMarkups.has(pageNum)) {
        pageMarkups.set(pageNum, []);
    }
    
    const ctx = markupLayer.getContext('2d');
    ctx.font = '24px Arial';
    const metrics = ctx.measureText(text);
    
    const markup = {
        type: 'text',
        x: point[0],
        y: point[1] + 24,
        text: text,
        color: markupColor,
        fontSize: 24,
        width: metrics.width,
        height: 24
    };
    pageMarkups.get(pageNum).push(markup);
    
    ctx.fillStyle = markup.color;
    ctx.fillText(markup.text, markup.x, markup.y);
    
    selectedMarkup = markup;
    renderMarkups(markupLayer, pageMarkups.get(pageNum), {});
}

function handleHighlightClick(markupLayer, point, pageNum) {
    if (!pageMarkups.has(pageNum)) {
        pageMarkups.set(pageNum, []);
    }
    
    const markup = {
        type: 'highlight',
        x: point[0] - 50,
        y: point[1] - 10,
        width: 100,
        height: 20,
        color: markupColor + '40'
    };
    pageMarkups.get(pageNum).push(markup);
    
    const ctx = markupLayer.getContext('2d');
    ctx.fillStyle = markup.color;
    ctx.fillRect(markup.x, markup.y, markup.width, markup.height);
    
    selectedMarkup = markup;
    renderMarkups(markupLayer, pageMarkups.get(pageNum), {});
}

function showSignaturePad(markupLayer, x, y) {
    try {
        if (!signaturePad || !signatureCtx) {
            console.error('Signature pad not properly initialized');
            return;
        }
        
        signaturePad.classList.add('active');
        signatureCtx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
        
        // Set up drawing context properties
        signatureCtx.strokeStyle = markupColor;
        signatureCtx.lineWidth = 2;
        signatureCtx.lineCap = 'round';
        signatureCtx.lineJoin = 'round';
        
        let isDrawing = false;
        let lastX = 0;
        let lastY = 0;
        
        function startDrawing(e) {
            try {
                isDrawing = true;
                const rect = signatureCanvas.getBoundingClientRect();
                lastX = e.clientX - rect.left;
                lastY = e.clientY - rect.top;
                console.log('Started drawing at:', lastX, lastY);
            } catch (error) {
                console.error('Error in startDrawing:', error);
            }
        }
    
        function draw(e) {
            try {
                if (!isDrawing) return;
                
                const rect = signatureCanvas.getBoundingClientRect();
                const currentX = e.clientX - rect.left;
                const currentY = e.clientY - rect.top;
                
                signatureCtx.beginPath();
                signatureCtx.moveTo(lastX, lastY);
                signatureCtx.lineTo(currentX, currentY);
                signatureCtx.stroke();
                
                lastX = currentX;
                lastY = currentY;
                
                console.log('Drawing to:', currentX, currentY);
            } catch (error) {
                console.error('Error in draw:', error);
            }
        }
        
        function stopDrawing() {
            isDrawing = false;
        }
        
        function cleanup() {
            try {
                console.log('Cleaning up signature pad event listeners');
                signatureCanvas.removeEventListener('mousedown', startDrawing);
                signatureCanvas.removeEventListener('mousemove', draw);
                signatureCanvas.removeEventListener('mouseup', stopDrawing);
                signatureCanvas.removeEventListener('mouseout', stopDrawing);
            } catch (error) {
                console.error('Error in cleanup:', error);
            }
        }
    
        cleanup(); // Remove any existing listeners
        signatureCanvas.addEventListener('mousedown', startDrawing);
        signatureCanvas.addEventListener('mousemove', draw);
        signatureCanvas.addEventListener('mouseup', stopDrawing);
        signatureCanvas.addEventListener('mouseout', stopDrawing);
        
        document.getElementById('saveSignature').onclick = () => {
            const pageNum = parseInt(markupLayer.parentElement.dataset.pageNumber);
            if (!pageMarkups.has(pageNum)) {
                pageMarkups.set(pageNum, []);
            }
            
            const markup = {
                type: 'signature',
                x: x,
                y: y,
                width: 200,
                height: 100,
                image: signatureCanvas.toDataURL()
            };
            pageMarkups.get(pageNum).push(markup);
            
            const ctx = markupLayer.getContext('2d');
            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, markup.x, markup.y, markup.width, markup.height);
                selectedMarkup = markup;
                renderMarkups(markupLayer, pageMarkups.get(pageNum), {});
            };
            img.src = markup.image;
            
            cleanup();
            signaturePad.classList.remove('active');
        };
        
        document.getElementById('clearSignature').onclick = () => {
            signatureCtx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
        };
        
        document.getElementById('cancelSignature').onclick = () => {
            cleanup();
            signaturePad.classList.remove('active');
        };
    } catch (error) {
        console.error('Error in showSignaturePad:', error);
    }
}

function renderMarkups(markupLayer, markups, viewport) {
    const ctx = markupLayer.getContext('2d');
    ctx.clearRect(0, 0, markupLayer.width, markupLayer.height);
    
    markups.forEach(markup => {
        switch (markup.type) {
            case 'draw':
                renderDrawMarkup(ctx, markup);
                break;
            case 'text':
                renderTextMarkup(ctx, markup);
                break;
            case 'highlight':
                renderHighlightMarkup(ctx, markup);
                break;
            case 'signature':
                renderSignatureMarkup(ctx, markup);
                break;
        }
        
        if (markup === selectedMarkup && markup.type !== 'draw') {
            renderSelectionHandles(ctx, markup);
        }
    });
}

function renderDrawMarkup(ctx, markup) {
    ctx.beginPath();
    ctx.strokeStyle = markup.color;
    ctx.lineWidth = 2;
    ctx.moveTo(markup.points[0][0], markup.points[0][1]);
    for (let i = 1; i < markup.points.length; i++) {
        ctx.lineTo(markup.points[i][0], markup.points[i][1]);
    }
    ctx.stroke();
}

function renderTextMarkup(ctx, markup) {
    try {
        ctx.font = `${markup.fontSize}px Arial`;
        ctx.fillStyle = markup.color;
        ctx.fillText(markup.text, markup.x, markup.y);
        
        const metrics = ctx.measureText(markup.text);
        if (metrics.width !== markup.width) {
            markup.width = metrics.width;
        }
    } catch (error) {
        console.error('Error rendering text markup:', error);
    }
}

function renderHighlightMarkup(ctx, markup) {
    ctx.fillStyle = markup.color;
    ctx.fillRect(markup.x, markup.y, markup.width, markup.height);
}

function renderSignatureMarkup(ctx, markup) {
    const img = new Image();
    img.onload = () => {
        ctx.drawImage(img, markup.x, markup.y, markup.width, markup.height);
    };
    img.src = markup.image;
}

function renderSelectionHandles(ctx, markup) {
    ctx.strokeStyle = '#0000ff';
    ctx.lineWidth = 1;
    
    const boxY = markup.type === 'text' ? markup.y - markup.height : markup.y;
    ctx.strokeRect(markup.x, boxY, markup.width, markup.height);
    
    const handleSize = 6;
    const handles = [
        [markup.x, boxY],
        [markup.x + markup.width, boxY],
        [markup.x, boxY + markup.height],
        [markup.x + markup.width, boxY + markup.height]
    ];
    
    handles.forEach(([x, y]) => {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - handleSize/2, y - handleSize/2, handleSize, handleSize);
        ctx.strokeRect(x - handleSize/2, y - handleSize/2, handleSize, handleSize);
    });

    // Add delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'markup-delete';
    deleteBtn.innerHTML = '<span class="material-icons">delete</span>';
    deleteBtn.onclick = (e) => {
        e.stopPropagation();
        const pageNum = parseInt(ctx.canvas.parentElement.dataset.pageNumber);
        const markups = pageMarkups.get(pageNum);
        const index = markups.indexOf(markup);
        if (index > -1) {
            markups.splice(index, 1);
            selectedMarkup = null;
            deleteBtn.remove();
            renderMarkups(ctx.canvas, markups, {});
        }
    };

    // Position the delete button relative to the markup
    deleteBtn.style.position = 'absolute';
    deleteBtn.style.top = `${boxY - 12}px`;
    deleteBtn.style.left = `${markup.x + markup.width - 12}px`;
    
    // Remove any existing delete buttons
    const existingBtn = ctx.canvas.parentElement.querySelector('.markup-delete');
    if (existingBtn) {
        existingBtn.remove();
    }
    
    ctx.canvas.parentElement.appendChild(deleteBtn);
}

function getCanvasPoint(e) {
    const rect = e.target.getBoundingClientRect();
    return [
        e.clientX - rect.left,
        e.clientY - rect.top
    ];
}

function handleToolButtonClick(e) {
    const allButtons = document.querySelectorAll('.tool-button');
    allButtons.forEach(btn => {
        btn.style.transition = 'all 0.2s ease';
        btn.classList.remove('active');
    });
    
    e.target.classList.add('active');
    currentTool = e.target.dataset.tool;
    selectedMarkup = null;
    
    document.querySelectorAll('.markup-layer').forEach(layer => {
        layer.className = 'markup-layer active';
        const pageNum = parseInt(layer.parentElement.dataset.pageNumber);
        if (pageMarkups.has(pageNum)) {
            renderMarkups(layer, pageMarkups.get(pageNum), {});
        }
    });
}

function handleClearMarkup() {
    const pageNum = currentPage;
    pageMarkups.delete(pageNum);
    selectedMarkup = null;
    
    const markupLayer = document.querySelector(
        `.page-container[data-page-number="${pageNum}"] .markup-layer`
    );
    if (markupLayer) {
        const ctx = markupLayer.getContext('2d');
        ctx.clearRect(0, 0, markupLayer.width, markupLayer.height);
    }
}

function handleZoomIn() {
    if (pdfDoc && currentZoomIndex < zoomLevels.length - 1) {
        currentZoomIndex++;
        scale = zoomLevels[currentZoomIndex];
        const zoomLevel = document.getElementById('zoomLevel');
        if (zoomLevel) {
            zoomLevel.textContent = `${Math.round(scale * 100)}%`;
        }
        renderAllPages();
    }
}

function handleZoomOut() {
    if (pdfDoc && currentZoomIndex > 0) {
        currentZoomIndex--;
        scale = zoomLevels[currentZoomIndex];
        const zoomLevel = document.getElementById('zoomLevel');
        if (zoomLevel) {
            zoomLevel.textContent = `${Math.round(scale * 100)}%`;
        }
        renderAllPages();
    }
}

async function handleAddBlankPage() {
    if (!pdfDoc) return;
    
    try {
        const pdfBytes = await pdfDoc.getData();
        const newPdf = await window.PDFLib.PDFDocument.load(pdfBytes);
        newPdf.insertPage(currentPage);
        
        const newPdfBytes = await newPdf.save();
        loadPDF(newPdfBytes);
    } catch (error) {
        console.error('Error adding blank page:', error);
        alert('Error adding blank page.');
    }
}

async function handleDeletePage() {
    if (!pdfDoc || pdfDoc.numPages <= 1) return;
    
    try {
        const pdfBytes = await pdfDoc.getData();
        const newPdf = await PDFLib.PDFDocument.load(pdfBytes);
        newPdf.removePage(currentPage - 1);
        
        const newPdfBytes = await newPdf.save();
        if (currentPage > newPdf.getPageCount()) {
            currentPage = newPdf.getPageCount();
        }
        loadPDF(newPdfBytes);
    } catch (error) {
        console.error('Error deleting page:', error);
        alert('Error deleting page.');
    }
}

async function handleMovePageUp() {
    if (!pdfDoc || currentPage <= 1) return;
    
    try {
        const pdfBytes = await pdfDoc.getData();
        const newPdf = await PDFLib.PDFDocument.create();
        const pages = await newPdf.copyPages(
            await PDFLib.PDFDocument.load(pdfBytes),
            Array.from(Array(pdfDoc.numPages).keys())
        );
        
        for (let i = 0; i < pages.length; i++) {
            if (i === currentPage - 1) {
                newPdf.addPage(pages[currentPage]);
            } else if (i === currentPage) {
                newPdf.addPage(pages[currentPage - 1]);
            } else {
                newPdf.addPage(pages[i]);
            }
        }
        
        const newPdfBytes = await newPdf.save();
        currentPage--;
        loadPDF(newPdfBytes);
    } catch (error) {
        console.error('Error moving page up:', error);
        alert('Error moving page up.');
    }
}

async function handleMovePageDown() {
    if (!pdfDoc || currentPage >= pdfDoc.numPages) return;
    
    try {
        const pdfBytes = await pdfDoc.getData();
        const newPdf = await PDFLib.PDFDocument.create();
        const pages = await newPdf.copyPages(
            await PDFLib.PDFDocument.load(pdfBytes),
            Array.from(Array(pdfDoc.numPages).keys())
        );
        
        for (let i = 0; i < pages.length; i++) {
            if (i === currentPage - 1) {
                newPdf.addPage(pages[currentPage]);
            } else if (i === currentPage) {
                newPdf.addPage(pages[currentPage - 1]);
            } else {
                newPdf.addPage(pages[i]);
            }
        }
        
        const newPdfBytes = await newPdf.save();
        currentPage++;
        loadPDF(newPdfBytes);
    } catch (error) {
        console.error('Error moving page down:', error);
        alert('Error moving page down.');
    }
}

async function handleDownload() {
    if (!pdfDoc) return;
    
    try {
        // Get selected quality
        const qualityOption = document.getElementById('pdfQuality')?.value;
        const useOriginalQuality = qualityOption === 'original';
        const quality = useOriginalQuality ? 1 : parseFloat(qualityOption || '1');
        
        // Create a new jsPDF instance
        const { jsPDF } = window.jspdf;
        
        // Get first page to determine orientation and dimensions
        const firstPage = await pdfDoc.getPage(1);
        const viewport = firstPage.getViewport({ scale: 1 });
        
        // Determine orientation based on viewport dimensions
        const orientation = viewport.width > viewport.height ? 'l' : 'p';
        
        const newPdf = new jsPDF({
            orientation: orientation,
            unit: 'pt',
            format: [viewport.width, viewport.height],
            compress: true,
            imageCompression: 'MEDIUM'
        });
        
        // Process each page
        for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
            const page = await pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale: 1 });
            
            const pageCanvas = document.createElement('canvas');
            pageCanvas.width = viewport.width;
            pageCanvas.height = viewport.height;
            
            await page.render({
                canvasContext: pageCanvas.getContext('2d'),
                viewport: viewport
            }).promise;
            
            if (pageMarkups.has(pageNum)) {
                const markupCanvas = document.createElement('canvas');
                markupCanvas.width = viewport.width;
                markupCanvas.height = viewport.height;
                
                renderMarkups(markupCanvas, pageMarkups.get(pageNum), viewport);
                
                await new Promise(resolve => setTimeout(resolve, 100));
                
                const ctx = pageCanvas.getContext('2d');
                ctx.drawImage(markupCanvas, 0, 0);
            }
            
            const imageData = pageCanvas.toDataURL(
                useOriginalQuality ? 'image/png' : 'image/jpeg',
                quality
            );
            
            if (pageNum > 1) {
                const currentViewport = page.getViewport({ scale: 1 });
                const currentOrientation = currentViewport.width > currentViewport.height ? 'l' : 'p';
                newPdf.addPage([currentViewport.width, currentViewport.height], currentOrientation);
            }
            
            newPdf.addImage(imageData, useOriginalQuality ? 'PNG' : 'JPEG', 0, 0, viewport.width, viewport.height, undefined, 'FAST');
        }
        
        const pdfOutput = newPdf.output('blob');
        
        const url = URL.createObjectURL(pdfOutput);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'edited_document.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error downloading PDF:', error);
        alert('Error downloading PDF file.');
    }
}

function handleSaveSignature() {
    // Empty since signature saving is handled in showSignaturePad
}

function handleClearSignature() {
    if (!signatureCtx || !signatureCanvas) return;
    signatureCtx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
}

function handleCancelSignature() {
    if (!signaturePad) return;
    signaturePad.classList.remove('active');
}

function updateUI() {
    const hasPDF = pdfDoc !== null;
    
    const elements = {
        zoomIn: document.getElementById('zoomIn'),
        zoomOut: document.getElementById('zoomOut'),
        markupColor: document.getElementById('markupColor'),
        clearMarkup: document.getElementById('clearMarkup'),
        addBlankPage: document.getElementById('addBlankPage'),
        deletePage: document.getElementById('deletePage'),
        movePageUp: document.getElementById('movePageUp'),
        movePageDown: document.getElementById('movePageDown'),
        pageFileInput: document.getElementById('pageFileInput'),
        pdfQuality: document.getElementById('pdfQuality')
    };
    
    Object.entries(elements).forEach(([key, element]) => {
        if (element) {
            if (key === 'deletePage') {
                element.disabled = !hasPDF || pdfDoc?.numPages <= 1;
            } else if (key === 'movePageUp') {
                element.disabled = !hasPDF || currentPage <= 1;
            } else if (key === 'movePageDown') {
                element.disabled = !hasPDF || currentPage >= (pdfDoc?.numPages || 0);
            } else {
                element.disabled = !hasPDF;
            }
        }
    });
    
    const toolButtons = document.querySelectorAll('.tool-button');
    toolButtons?.forEach(button => {
        button.disabled = !hasPDF;
    });
}

function isPointInMarkup(point, markup) {
    if (markup.type === 'draw') {
        // For draw markups, check if point is near any line segment
        for (let i = 1; i < markup.points.length; i++) {
            const start = markup.points[i - 1];
            const end = markup.points[i];
            const distance = distanceToLineSegment(point, start, end);
            if (distance < 5) return true; // 5px tolerance
        }
        return false;
    }

    const x = point[0];
    const y = point[1];
    const boxY = markup.type === 'text' ? markup.y - markup.height : markup.y;
    
    return x >= markup.x && 
           x <= markup.x + markup.width && 
           y >= boxY && 
           y <= boxY + markup.height;
}

function getResizeHandle(point, markup) {
    const handleSize = 6;
    const [x, y] = point;
    const boxY = markup.type === 'text' ? markup.y - markup.height : markup.y;
    
    const handles = {
        'top-left': [markup.x, boxY],
        'top-right': [markup.x + markup.width, boxY],
        'bottom-left': [markup.x, boxY + markup.height],
        'bottom-right': [markup.x + markup.width, boxY + markup.height]
    };
    
    for (const [handle, [hx, hy]] of Object.entries(handles)) {
        if (Math.abs(x - hx) <= handleSize/2 && Math.abs(y - hy) <= handleSize/2) {
            return handle;
        }
    }
    
    return null;
}

function distanceToLineSegment(point, start, end) {
    const [x, y] = point;
    const [x1, y1] = start;
    const [x2, y2] = end;
    
    const A = x - x1;
    const B = y - y1;
    const C = x2 - x1;
    const D = y2 - y1;
    
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    
    if (lenSq !== 0) {
        param = dot / lenSq;
    }
    
    let xx, yy;
    
    if (param < 0) {
        xx = x1;
        yy = y1;
    } else if (param > 1) {
        xx = x2;
        yy = y2;
    } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
    }
    
    const dx = x - xx;
    const dy = y - yy;
    
    return Math.sqrt(dx * dx + dy * dy);
}

function setCurrentPage(num) {
    currentPage = num;
    document.querySelectorAll('.page-container').forEach(container => {
        container.classList.toggle('current-page', 
            parseInt(container.dataset.pageNumber) === currentPage);
    });
    updateUI();
}
