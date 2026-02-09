// State
let currentBoard = 'current';
let cards = [];

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');
const refreshBtn = document.getElementById('refresh-btn');
const uploadBtn = document.getElementById('upload-btn');

const boardTabs = document.querySelectorAll('.board-tab');
const addCardModal = document.getElementById('add-card-modal');
const uploadModal = document.getElementById('upload-modal');
const addCardForm = document.getElementById('add-card-form');
const uploadForm = document.getElementById('upload-form');

// Initialize
checkAuth();

// Authentication
async function checkAuth() {
    try {
        const response = await fetch('/api/auth-status');
        const data = await response.json();
        
        if (data.authenticated) {
            showApp();
            loadBoard();
            loadUploads();
        } else {
            showLogin();
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        showLogin();
    }
}

function showLogin() {
    loginScreen.classList.remove('hidden');
    appScreen.classList.add('hidden');
}

function showApp() {
    loginScreen.classList.add('hidden');
    appScreen.classList.remove('hidden');
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = document.getElementById('password').value;
    loginError.textContent = '';
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        
        if (response.ok) {
            showApp();
            loadBoard();
            loadUploads();
        } else {
            loginError.textContent = 'Invalid password';
        }
    } catch (error) {
        loginError.textContent = 'Login failed';
    }
});

logoutBtn.addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    showLogin();
});

refreshBtn.addEventListener('click', () => {
    loadBoard();
    loadUploads();
});

// Board switching
boardTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        boardTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentBoard = tab.dataset.board;
        loadBoard();
    });
});

// Load board
async function loadBoard() {
    try {
        const response = await fetch(`/api/cards/${currentBoard}`);
        cards = await response.json();
        renderBoard();
    } catch (error) {
        console.error('Failed to load board:', error);
    }
}

function renderBoard() {
    // Clear columns
    document.querySelectorAll('.cards').forEach(col => col.innerHTML = '');
    
    // Group cards by column
    const columns = { 'todo': [], 'in-progress': [], 'done': [] };
    cards.forEach(card => {
        if (columns[card.column_name]) {
            columns[card.column_name].push(card);
        }
    });
    
    // Render cards
    Object.keys(columns).forEach(colName => {
        const cardsContainer = document.querySelector(`.cards[data-column="${colName}"]`);
        columns[colName].forEach(card => {
            cardsContainer.appendChild(createCardElement(card));
        });
    });
    
    // Setup drag and drop
    setupDragAndDrop();
}

function createCardElement(card) {
    const div = document.createElement('div');
    div.className = 'card';
    div.draggable = true;
    div.dataset.id = card.id;
    
    const priorityClass = card.priority || 'medium';
    
    div.innerHTML = `
        <div class="card-header">
            <div class="card-title">${escapeHtml(card.title)}</div>
            <span class="card-priority ${priorityClass}">${priorityClass}</span>
        </div>
        ${card.description ? `<div class="card-description">${escapeHtml(card.description)}</div>` : ''}
        <div class="card-actions">
            <button class="delete-btn" onclick="deleteCard(${card.id})">Delete</button>
        </div>
    `;
    
    return div;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Drag and drop
function setupDragAndDrop() {
    const draggables = document.querySelectorAll('.card');
    const containers = document.querySelectorAll('.cards');
    
    draggables.forEach(draggable => {
        draggable.addEventListener('dragstart', () => {
            draggable.classList.add('dragging');
        });
        
        draggable.addEventListener('dragend', async () => {
            draggable.classList.remove('dragging');
            
            // Get new column
            const newColumn = draggable.closest('.cards').dataset.column;
            const cardId = draggable.dataset.id;
            
            // Get position
            const cardsInColumn = Array.from(draggable.closest('.cards').children);
            const position = cardsInColumn.indexOf(draggable);
            
            // Find card data
            const card = cards.find(c => c.id == cardId);
            if (card) {
                await updateCard(cardId, {
                    ...card,
                    column_name: newColumn,
                    position: position
                });
            }
        });
    });
    
    containers.forEach(container => {
        container.addEventListener('dragover', e => {
            e.preventDefault();
            const afterElement = getDragAfterElement(container, e.clientY);
            const draggable = document.querySelector('.dragging');
            if (afterElement == null) {
                container.appendChild(draggable);
            } else {
                container.insertBefore(draggable, afterElement);
            }
        });
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.card:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// Add card
document.querySelectorAll('.add-card-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.getElementById('card-column').value = btn.dataset.column;
        addCardModal.classList.remove('hidden');
    });
});

addCardForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const cardData = {
        board: currentBoard,
        column_name: document.getElementById('card-column').value,
        title: document.getElementById('card-title').value,
        description: document.getElementById('card-description').value,
        priority: document.getElementById('card-priority').value
    };
    
    try {
        const response = await fetch('/api/cards', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cardData)
        });
        
        if (response.ok) {
            addCardModal.classList.add('hidden');
            addCardForm.reset();
            loadBoard();
        }
    } catch (error) {
        console.error('Failed to add card:', error);
    }
});

async function updateCard(id, cardData) {
    try {
        await fetch(`/api/cards/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cardData)
        });
    } catch (error) {
        console.error('Failed to update card:', error);
    }
}

async function deleteCard(id) {
    if (!confirm('Delete this card?')) return;
    
    try {
        const response = await fetch(`/api/cards/${id}`, { method: 'DELETE' });
        if (response.ok) {
            loadBoard();
        }
    } catch (error) {
        console.error('Failed to delete card:', error);
    }
}

// File upload
uploadBtn.addEventListener('click', () => {
    uploadModal.classList.remove('hidden');
});

uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const fileInput = document.getElementById('file-input');
    const file = fileInput.files[0];
    
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    const status = document.getElementById('upload-status');
    status.textContent = 'Uploading...';
    status.className = '';
    status.classList.remove('hidden');
    
    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok) {
            status.textContent = result.gdriveUrl 
                ? `✅ Uploaded to Google Drive: ${result.filename}`
                : `✅ Uploaded: ${result.filename}`;
            status.classList.add('success');
            
            setTimeout(() => {
                uploadModal.classList.add('hidden');
                uploadForm.reset();
                status.classList.add('hidden');
                loadUploads();
            }, 2000);
        } else {
            status.textContent = `❌ Upload failed: ${result.error}`;
            status.classList.add('error');
        }
    } catch (error) {
        status.textContent = `❌ Upload failed: ${error.message}`;
        status.classList.add('error');
    }
});

// Load uploads
async function loadUploads() {
    try {
        const response = await fetch('/api/uploads');
        const uploads = await response.json();
        
        const list = document.getElementById('uploads-list');
        list.innerHTML = uploads.length 
            ? uploads.map(u => `
                <div class="upload-item">
                    <span>${u.filename}</span>
                    ${u.gdrive_url 
                        ? `<a href="${u.gdrive_url}" target="_blank">View in Drive →</a>`
                        : '<span style="color: var(--text-light);">No Drive link</span>'}
                </div>
            `).join('')
            : '<p style="text-align: center; color: var(--text-light);">No uploads yet</p>';
    } catch (error) {
        console.error('Failed to load uploads:', error);
    }
}

// Modal close handlers
document.querySelectorAll('.close-modal, .cancel-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        addCardModal.classList.add('hidden');
        uploadModal.classList.add('hidden');
    });
});

// Close modal on outside click
window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.add('hidden');
    }
});
