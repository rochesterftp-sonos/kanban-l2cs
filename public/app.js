// State
let currentBoard = 'Marketing & Sales 60-Day Plan';
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
const kanbanContainer = document.querySelector('.kanban-container');

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
        const encodedBoard = encodeURIComponent(currentBoard);
        const response = await fetch(`/api/cards/${encodedBoard}`);
        cards = await response.json();
        renderBoard();
    } catch (error) {
        console.error('Failed to load board:', error);
    }
}

function renderBoard() {
    // Get unique columns for this board
    const columns = [...new Set(cards.map(c => c.column_name))].sort();
    
    // Rebuild kanban container with dynamic columns
    kanbanContainer.innerHTML = '';
    
    columns.forEach(colName => {
        const col = document.createElement('div');
        col.className = 'column';
        col.dataset.column = colName;
        
        const header = document.createElement('div');
        header.className = 'column-header';
        header.innerHTML = `
            <h2>${colName}</h2>
            <button class="add-card-btn" data-column="${colName}">+</button>
        `;
        
        const cardsDiv = document.createElement('div');
        cardsDiv.className = 'cards';
        cardsDiv.dataset.column = colName;
        
        // Add cards for this column
        cards
            .filter(card => card.column_name === colName)
            .sort((a, b) => a.position - b.position)
            .forEach(card => {
                cardsDiv.appendChild(createCardElement(card));
            });
        
        col.appendChild(header);
        col.appendChild(cardsDiv);
        kanbanContainer.appendChild(col);
        
        // Add event listener to add card button
        header.querySelector('.add-card-btn').addEventListener('click', () => {
            openAddCardModal(colName);
        });
    });
    
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
            <h3>${card.title}</h3>
            <span class="priority ${priorityClass}">${card.priority || 'medium'}</span>
        </div>
        <p class="card-description">${card.description || ''}</p>
        <button class="delete-btn" data-id="${card.id}">🗑️</button>
    `;
    
    div.querySelector('.delete-btn').addEventListener('click', async () => {
        if (confirm('Delete this card?')) {
            await fetch(`/api/cards/${card.id}`, { method: 'DELETE' });
            loadBoard();
        }
    });
    
    return div;
}

function setupDragAndDrop() {
    const cards = document.querySelectorAll('.card');
    const cardsContainers = document.querySelectorAll('.cards');
    
    cards.forEach(card => {
        card.addEventListener('dragstart', (e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('cardId', card.dataset.id);
        });
    });
    
    cardsContainers.forEach(container => {
        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            container.style.backgroundColor = 'rgba(0,0,0,0.05)';
        });
        
        container.addEventListener('dragleave', () => {
            container.style.backgroundColor = '';
        });
        
        container.addEventListener('drop', async (e) => {
            e.preventDefault();
            container.style.backgroundColor = '';
            const cardId = e.dataTransfer.getData('cardId');
            const newColumn = container.dataset.column;
            
            await moveCard(cardId, newColumn);
            loadBoard();
        });
    });
}

async function moveCard(cardId, newColumn) {
    const card = cards.find(c => c.id == cardId);
    if (!card) return;
    
    try {
        await fetch(`/api/cards/${cardId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                column_name: newColumn,
                position: 0,
                title: card.title,
                description: card.description,
                priority: card.priority
            })
        });
    } catch (error) {
        console.error('Failed to move card:', error);
    }
}

function openAddCardModal(column) {
    document.getElementById('card-column').value = column;
    addCardModal.classList.remove('hidden');
}

// Add card form
addCardForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('card-title').value;
    const description = document.getElementById('card-description').value;
    const priority = document.getElementById('card-priority').value;
    const column = document.getElementById('card-column').value;
    
    try {
        await fetch('/api/cards', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                board: currentBoard,
                column_name: column,
                title,
                description,
                priority
            })
        });
        
        addCardModal.classList.add('hidden');
        addCardForm.reset();
        loadBoard();
    } catch (error) {
        console.error('Failed to add card:', error);
    }
});

// Modal controls
document.querySelectorAll('.close-modal, .cancel-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.target.closest('.modal').classList.add('hidden');
    });
});

uploadBtn.addEventListener('click', () => {
    uploadModal.classList.remove('hidden');
});

// Upload form
uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('file-input');
    const file = fileInput.files[0];
    
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            document.getElementById('upload-status').textContent = '✅ Upload successful!';
            document.getElementById('upload-status').classList.remove('hidden');
            setTimeout(() => {
                uploadModal.classList.add('hidden');
                uploadForm.reset();
                document.getElementById('upload-status').classList.add('hidden');
                loadUploads();
            }, 2000);
        }
    } catch (error) {
        console.error('Upload failed:', error);
        document.getElementById('upload-status').textContent = '❌ Upload failed';
        document.getElementById('upload-status').classList.remove('hidden');
    }
});

// Load uploads
async function loadUploads() {
    try {
        const response = await fetch('/api/uploads');
        const uploads = await response.json();
        const uploadsList = document.getElementById('uploads-list');
        
        uploadsList.innerHTML = uploads.slice(0, 5).map(upload => `
            <div class="upload-item">
                <a href="${upload.gdrive_url || '#'}" target="_blank">
                    📄 ${upload.filename}
                </a>
                <span class="upload-date">${new Date(upload.uploaded_at).toLocaleDateString()}</span>
            </div>
        `).join('');
    } catch (error) {
        console.error('Failed to load uploads:', error);
    }
}
// Updated Mon Feb  9 08:51:40 PM EST 2026
