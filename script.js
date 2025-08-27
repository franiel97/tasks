let data = {};
let currentUser = null;
let rejectionId = null;
let editId = null;
let editType = null;
const DB_URL = 'https://franiel97.github.io/tasks/data.json'; // Ajuste para seu repo
//const GH_TOKEN = ''; // Adicione seu PAT (não commit!)
const REPO_OWNER = 'franiel97';
const REPO_NAME = 'tasks';
const FILE_PATH = 'data.json';

async function hashPassword(password) {
    try {
        const encoder = new TextEncoder();
        const hashData = encoder.encode(password);
        const hash = await crypto.subtle.digest('SHA-256', hashData);
        return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
        console.warn('Web Crypto falhou, usando fallback:', e);
        return CryptoJS.SHA256(password).toString(CryptoJS.enc.Hex);
    }
}

async function fetchData() {
    try {
        const res = await fetch(DB_URL);
        if (!res.ok) throw new Error('Fetch failed');
        data = await res.json();
        localStorage.setItem('data', JSON.stringify(data)); // Salva no localStorage
    } catch (e) {
        console.error('Erro ao carregar DB:', e);
        data = JSON.parse(localStorage.getItem('data') || '{}');
        data.notifications = data.notifications || [];
        data.notifications.push({
            id: (data.notifications.length || 0) + 1,
            userId: currentUser ? currentUser.id : null,
            message: 'Falha ao sincronizar com o servidor. Usando dados locais.',
            read: false,
            createdAt: new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
        });
        await saveData();
    }
}

async function saveData() {
    localStorage.setItem('data', JSON.stringify(data));
    if (GH_TOKEN) {
        try {
            const content = btoa(JSON.stringify(data, null, 2));
            const sha = await getFileSha();
            const res = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${GH_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: `Update data.json at ${new Date().toISOString()}`,
                    content: content,
                    sha: sha
                })
            });
            if (!res.ok) throw new Error('Failed to update GitHub');
        } catch (e) {
            console.error('Erro ao salvar no GitHub:', e);
            data.notifications.push({
                id: data.notifications.length + 1,
                userId: currentUser ? currentUser.id : null,
                message: 'Falha ao salvar no servidor. Dados salvos localmente.',
                read: false,
                createdAt: new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
            });
            localStorage.setItem('data', JSON.stringify(data));
            if (currentUser) renderNotificationsDropdown();
        }
    }
}

async function getFileSha() {
    try {
        const res = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`, {
            headers: { 'Authorization': `token ${GH_TOKEN}` }
        });
        if (res.status === 404) return null; // Arquivo não existe
        const json = await res.json();
        return json.sha;
    } catch (e) {
        console.error('Erro ao obter SHA:', e);
        return null;
    }
}

function checkSession() {
    const session = JSON.parse(localStorage.getItem('session'));
    if (session) {
        const now = new Date();
        const expiry = new Date(session.expiry);
        if (now < expiry && session.userId) {
            currentUser = data.users.find(u => u.id === session.userId);
            return !!currentUser;
        }
    }
    return false;
}

function setSession(user) {
    const now = new Date();
    const expiry = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    localStorage.setItem('session', JSON.stringify({ userId: user.id, expiry: expiry.toISOString() }));
}

function updatePointsDisplay() {
    if (currentUser) {
        document.getElementById('current-points').textContent = currentUser.currentPoints;
    }
}

function toggleMenu() {
    const menu = document.getElementById('sidebar-menu');
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
}

function toggleNotifications() {
    const list = document.getElementById('notifications-list');
    list.style.display = list.style.display === 'block' ? 'none' : 'block';
    if (list.style.display === 'block') renderNotificationsDropdown();
}

function renderNotificationsDropdown() {
    const list = document.getElementById('notifications-list');
    list.innerHTML = '';
    const ul = document.createElement('ul');
    const userNotifs = data.notifications.filter(n => n.userId === currentUser.id);
    userNotifs.forEach(notif => {
        const li = document.createElement('li');
        li.textContent = notif.message;
        if (!notif.read) li.classList.add('unread');
        li.onclick = () => {
            notif.read = true;
            showUserTab(notif.link);
            toggleNotifications();
            updateUnreadCount();
            saveData();
        };
        ul.appendChild(li);
    });
    if (!userNotifs.length) {
        ul.innerHTML = '<li>Nenhuma notificação.</li>';
    }
    list.appendChild(ul);
    updateUnreadCount();
}

function updateUnreadCount() {
    const unreadCount = data.notifications.filter(n => n.userId === currentUser.id && !n.read).length;
    const unreadBadge = document.getElementById('unread-count');
    unreadBadge.textContent = unreadCount;
    unreadBadge.style.display = unreadCount > 0 ? 'inline' : 'none';
}

function changeTheme(theme) {
    document.body.dataset.theme = theme;
    localStorage.setItem('theme', theme);
    document.getElementById('color-selector').style.display = theme === 'ios' ? 'none' : 'block';
    const defaultColor = theme === 'android' ? '#6200ea' : theme === 'web' ? '#007bff' : '#007bff';
    document.body.style.setProperty('--primary-color', defaultColor);
    document.getElementById('primary-color').value = defaultColor;
    localStorage.setItem('primaryColor', defaultColor);
    document.documentElement.style.setProperty('--primary', defaultColor);
}

function changePrimaryColor(color) {
    document.body.style.setProperty('--primary-color', color);
    document.documentElement.style.setProperty('--primary', color);
    localStorage.setItem('primaryColor', color);
}

function toggleDarkMode(enabled) {
    document.body.dataset.dark = enabled;
    localStorage.setItem('darkMode', enabled);
}

// Inicialização
(async () => {
    await fetchData();
    if (!data.users) data.users = [];
    if (!data.tasks) data.tasks = [];
    if (!data.products) data.products = [];
    if (!data.requests) data.requests = [];
    if (!data.notifications) data.notifications = [];
    if (data.users.length === 0) {
        const adminHash = await hashPassword('admin123');
        data.users.push({ id: 1, username: 'admin', passwordHash: adminHash, type: 'admin', totalPoints: 0, currentPoints: 0 });
        await saveData();
    }
    if (checkSession()) {
        document.getElementById('login-section').style.display = 'none';
        document.getElementById('header').style.display = 'flex';
        document.getElementById('main-nav').style.display = 'block';
        document.getElementById('logout-btn').style.display = 'inline-flex';
        if (currentUser.type === 'admin') document.getElementById('admin-btn').style.display = 'inline-flex';
        renderNotificationsDropdown();
        updatePointsDisplay();
        switchToUser();
    } else {
        document.getElementById('login-section').style.display = 'flex';
        document.getElementById('header').style.display = 'none';
        document.getElementById('user-section').style.display = 'none';
        document.getElementById('admin-section').style.display = 'none';
    }
    // Inicializar temas
    const savedTheme = localStorage.getItem('theme') || 'web';
    changeTheme(savedTheme);
    document.getElementById('theme-select').value = savedTheme;
    const savedColor = localStorage.getItem('primaryColor') || (savedTheme === 'android' ? '#6200ea' : '#007bff');
    changePrimaryColor(savedColor);
    document.getElementById('primary-color').value = savedColor;
    const savedDark = localStorage.getItem('darkMode') === 'true';
    toggleDarkMode(savedDark);
    document.getElementById('dark-mode').checked = savedDark;
    document.getElementById('color-selector').style.display = savedTheme === 'ios' ? 'none' : 'block';

    // Fechar notificações ao clicar fora
    document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('notifications-list');
        const btn = document.getElementById('notifications-btn');
        if (dropdown.style.display === 'block' && !dropdown.contains(e.target) && !btn.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
})();

// Login
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await fetchData();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const hash = await hashPassword(password);
    const user = data.users.find(u => u.username === username && u.passwordHash === hash);
    if (user) {
        currentUser = user;
        setSession(user);
        document.getElementById('login-section').style.display = 'none';
        document.getElementById('header').style.display = 'flex';
        document.getElementById('main-nav').style.display = 'block';
        document.getElementById('logout-btn').style.display = 'inline-flex';
        if (user.type === 'admin') document.getElementById('admin-btn').style.display = 'inline-flex';
        renderNotificationsDropdown();
        updatePointsDisplay();
        switchToUser();
    } else {
        data.notifications.push({
            id: data.notifications.length + 1,
            userId: null,
            message: 'Usuário ou senha inválidos.',
            read: false,
            createdAt: new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
        });
        await saveData();
        renderNotificationsDropdown();
    }
});

// Logout
function logout() {
    currentUser = null;
    localStorage.removeItem('session');
    location.reload();
}

// Alternar visões
function switchToUser() {
    document.getElementById('admin-section').style.display = 'none';
    document.getElementById('user-section').style.display = 'block';
    renderUserTabs();
    showUserTab('tasks');
    const adminBtn = document.getElementById('admin-btn');
    adminBtn.innerHTML = '<i class="fas fa-cog"></i> <span>Admin</span>';
    adminBtn.onclick = switchToAdmin;
    updatePointsDisplay();
}

function switchToAdmin() {
    document.getElementById('user-section').style.display = 'none';
    document.getElementById('admin-section').style.display = 'block';
    renderAdminTabs();
    showAdminTab('users');
    const adminBtn = document.getElementById('admin-btn');
    adminBtn.innerHTML = '<i class="fas fa-eye"></i> <span>Visão Usuário</span>';
    adminBtn.onclick = switchToUser;
    updatePointsDisplay();
}

// Render tabs
function renderUserTabs() {
    const tabs = document.getElementById('user-tabs');
    tabs.innerHTML = '';
    const tabData = [
        { label: 'Tarefas', icon: 'fa-list', tab: 'tasks' },
        { label: 'Produtos', icon: 'fa-shopping-bag', tab: 'products' },
        { label: 'Solicitados', icon: 'fa-box', tab: 'requested-products' },
        { label: 'Ranking', icon: 'fa-trophy', tab: 'ranking' },
        { label: 'Tarefas Concluídas', icon: 'fa-check-circle', tab: 'completed-tasks' }
    ];
    tabData.forEach(data => {
        const btn = document.createElement('button');
        btn.innerHTML = `<i class="fas ${data.icon}"></i> <span>${data.label}</span>`;
        btn.onclick = () => showUserTab(data.tab);
        tabs.appendChild(btn);
    });
}

function renderAdminTabs() {
    const tabs = document.getElementById('admin-tabs');
    tabs.innerHTML = '';
    const tabData = [
        { label: 'Usuários', icon: 'fa-users', tab: 'users' },
        { label: 'Tarefas', icon: 'fa-tasks', tab: 'tasks' },
        { label: 'Produtos', icon: 'fa-box-open', tab: 'products' },
        { label: 'Solicitações', icon: 'fa-exchange-alt', tab: 'requests' },
        { label: 'Rankings', icon: 'fa-chart-bar', tab: 'rankings' }
    ];
    tabData.forEach(data => {
        const btn = document.createElement('button');
        btn.innerHTML = `<i class="fas ${data.icon}"></i> <span>${data.label}</span>`;
        btn.onclick = () => showAdminTab(data.tab);
        tabs.appendChild(btn);
    });
}

// User tabs
async function showUserTab(tab) {
    await fetchData();
    const content = document.getElementById('user-content');
    content.innerHTML = '';
    switch (tab) {
        case 'tasks':
            renderTasks(content);
            break;
        case 'products':
            renderProducts(content);
            break;
        case 'requested-products':
            renderRequestedProducts(content);
            break;
        case 'ranking':
            renderUserRanking(content);
            break;
        case 'completed-tasks':
            renderCompletedTasks(content);
            break;
    }
}

function renderTasks(content) {
    const calendar = document.createElement('div');
    calendar.classList.add('calendar');
    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const today = new Date();
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - today.getDay());

    for (let i = 0; i < 7; i++) {
        const dayDate = new Date(sunday);
        dayDate.setDate(sunday.getDate() + i);
        const dayStr = dayDate.toLocaleDateString('pt-BR');
        const dayDiv = document.createElement('div');
        dayDiv.classList.add('day');
        dayDiv.innerHTML = `<h3>${days[i]} (${dayStr})</h3>`;
        const userTasks = data.tasks.filter(t => t.userId === currentUser.id && t.day === days[i] && !t.completed);
        userTasks.forEach(task => {
            const block = document.createElement('div');
            block.classList.add('task-block');
            block.innerHTML = `<p>${task.name} - ${task.points} pontos</p>`;
            const btn = document.createElement('button');
            btn.textContent = 'Concluída';
            btn.classList.add('complete-btn');
            btn.onclick = () => completeTask(task.id);
            block.appendChild(btn);
            dayDiv.appendChild(block);
        });
        calendar.appendChild(dayDiv);
    }
    content.appendChild(calendar);
}

async function completeTask(taskId) {
    await fetchData();
    const task = data.tasks.find(t => t.id === taskId);
    if (task && task.userId === currentUser.id) {
        task.completed = true;
        task.completedAt = new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
        currentUser.totalPoints += task.points;
        currentUser.currentPoints += task.points;
        data.notifications.push({
            id: data.notifications.length + 1,
            userId: currentUser.id,
            message: `Tarefa "${task.name}" concluída! +${task.points} pontos.`,
            link: 'completed-tasks',
            read: false,
            createdAt: new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
        });
        await saveData();
        updatePointsDisplay();
        renderNotificationsDropdown();
        showUserTab('tasks');
    }
}

function renderCompletedTasks(content) {
    content.innerHTML = '';
    const table = document.createElement('table');
    table.innerHTML = '<tr><th>Tarefa</th><th>Pontos</th><th>Concluída em</th></tr>';
    const completedTasks = data.tasks.filter(t => t.userId === currentUser.id && t.completed);
    completedTasks.forEach(task => {
        table.innerHTML += `<tr><td>${task.name}</td><td>${task.points}</td><td>${task.completedAt}</td></tr>`;
    });
    content.appendChild(table);
}

function renderProducts(content) {
    content.innerHTML = '';
    const table = document.createElement('table');
    table.innerHTML = '<tr><th>Produto</th><th>Pontos</th><th>Ação</th></tr>';
    data.products.forEach(product => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${product.name}</td><td>${product.points}</td>`;
        const td = document.createElement('td');
        const btn = document.createElement('button');
        btn.textContent = 'Resgatar';
        btn.onclick = () => showModal(`Trocar ${product.points} pontos por ${product.name}?`, () => {
            requestProduct(product.id);
            closeModal();
        });
        td.appendChild(btn);
        tr.appendChild(td);
        table.appendChild(tr);
    });
    content.appendChild(table);
}

async function requestProduct(productId) {
    await fetchData();
    const product = data.products.find(p => p.id === productId);
    if (currentUser.currentPoints >= product.points) {
        data.requests.push({
            id: data.requests.length + 1,
            userId: currentUser.id,
            productId: productId,
            status: 'Aguardando Avaliação',
            justification: '',
            createdAt: new Date().toLocaleDateString('pt-BR'),
            moderatedAt: ''
        });
        data.notifications.push({
            id: data.notifications.length + 1,
            userId: currentUser.id,
            message: `Solicitação de ${product.name} aguardando avaliação.`,
            link: 'requested-products',
            read: false,
            createdAt: new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
        });
        await saveData();
        renderNotificationsDropdown();
        showUserTab('products');
    } else {
        data.notifications.push({
            id: data.notifications.length + 1,
            userId: currentUser.id,
            message: 'Pontos insuficientes para resgatar ' + product.name + '.',
            link: 'products',
            read: false,
            createdAt: new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
        });
        await saveData();
        renderNotificationsDropdown();
    }
}

function renderRequestedProducts(content) {
    content.innerHTML = '';
    const table = document.createElement('table');
    table.innerHTML = '<tr><th>Produto</th><th>Status</th><th>Criado</th><th>Moderado</th><th>Justificativa</th><th>Ação</th></tr>';
    const userRequests = data.requests.filter(r => r.userId === currentUser.id);
    userRequests.forEach(req => {
        const product = data.products.find(p => p.id === req.productId);
        const tr = document.createElement('tr');
        let iconClass = req.status === 'Aguardando Avaliação' ? 'fa-clock' : req.status === 'Aprovado' ? 'fa-check' : 'fa-times';
        tr.innerHTML = `
            <td><i class="fas ${iconClass} request-item"></i> ${product.name}</td>
            <td>${req.status}</td>
            <td>${req.createdAt}</td>
            <td>${req.moderatedAt || '-'}</td>
            <td>${req.justification || '-'}</td>
        `;
        const td = document.createElement('td');
        if (req.status === 'Aguardando Avaliação') {
            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = 'Cancelar';
            cancelBtn.classList.add('delete-btn');
            cancelBtn.onclick = () => showModal(`Cancelar solicitação de ${product.name}? Receberá ${Math.floor(product.points / 2)} pontos de volta.`, () => {
                cancelRequest(req.id);
                closeModal();
            });
            td.appendChild(cancelBtn);
        }
        tr.appendChild(td);
        table.appendChild(tr);
    });
    content.appendChild(table);
}

async function cancelRequest(requestId) {
    await fetchData();
    const req = data.requests.find(r => r.id === requestId);
    if (req && req.status === 'Aguardando Avaliação') {
        const product = data.products.find(p => p.id === req.productId);
        const refundPoints = Math.floor(product.points / 2);
        data.requests = data.requests.filter(r => r.id !== requestId);
        currentUser.currentPoints += refundPoints;
        data.notifications.push({
            id: data.notifications.length + 1,
            userId: currentUser.id,
            message: `Solicitação de ${product.name} cancelada. +${refundPoints} pontos reembolsados.`,
            link: 'requested-products',
            read: false,
            createdAt: new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
        });
        await saveData();
        updatePointsDisplay();
        renderNotificationsDropdown();
        showUserTab('requested-products');
    }
}

function renderUserRanking(content) {
    content.innerHTML = '';
    const sortedUsers = [...data.users].sort((a, b) => b.totalPoints - a.totalPoints);
    const table = document.createElement('table');
    table.innerHTML = '<tr><th>Usuário</th><th>Pontos Totais</th></tr>';
    sortedUsers.forEach(user => {
        table.innerHTML += `<tr><td>${user.username}</td><td>${user.totalPoints}</td></tr>`;
    });
    content.appendChild(table);
}

// Admin tabs
async function showAdminTab(tab) {
    if (currentUser.type !== 'admin') return;
    await fetchData();
    const content = document.getElementById('admin-content');
    content.innerHTML = '';
    switch (tab) {
        case 'users':
            renderUsersAdmin(content);
            break;
        case 'tasks':
            renderTasksAdmin(content);
            break;
        case 'products':
            renderProductsAdmin(content);
            break;
        case 'requests':
            renderRequestsAdmin(content);
            break;
        case 'rankings':
            renderRankingsAdmin(content);
            break;
    }
}

function renderUsersAdmin(content) {
    content.innerHTML = '';
    const form = document.createElement('form');
    form.innerHTML = `
        <div class="form-group"><label>Username:</label><input type="text" id="new-username" required></div>
        <div class="form-group"><label>Senha:</label><input type="password" id="new-password" required></div>
        <div class="form-group"><label>Tipo:</label><select id="new-type"><option value="common">Comum</option><option value="admin">Admin</option></select></div>
        <button type="submit">Cadastrar</button>
    `;
    form.onsubmit = async (e) => {
        e.preventDefault();
        await fetchData();
        const username = document.getElementById('new-username').value;
        const password = document.getElementById('new-password').value;
        const type = document.getElementById('new-type').value;
        const hash = await hashPassword(password);
        if (!data.users.find(u => u.username === username)) {
            data.users.push({ id: data.users.length + 1, username, passwordHash: hash, type, totalPoints: 0, currentPoints: 0 });
            await saveData();
            renderUsersAdmin(content);
        } else {
            data.notifications.push({
                id: data.notifications.length + 1,
                userId: currentUser.id,
                message: 'Usuário já existe.',
                read: false,
                createdAt: new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
            });
            await saveData();
            renderNotificationsDropdown();
        }
    };
    content.appendChild(form);

    const table = document.createElement('table');
    table.innerHTML = '<tr><th>Usuário</th><th>Tipo</th><th>Pontos Totais</th><th>Pontos Atuais</th><th>Ações</th></tr>';
    data.users.forEach(user => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${user.username}</td><td>${user.type}</td><td>${user.totalPoints}</td><td>${user.currentPoints}</td>`;
        const td = document.createElement('td');
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Editar';
        editBtn.classList.add('edit-btn');
        editBtn.onclick = () => editItem('user', user.id);
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Excluir';
        deleteBtn.classList.add('delete-btn');
        deleteBtn.onclick = () => showModal(`Excluir usuário ${user.username}?`, () => {
            deleteItem('user', user.id);
            closeModal();
        });
        td.append(editBtn, deleteBtn);
        tr.appendChild(td);
        table.appendChild(tr);
    });
    content.appendChild(table);
}

function renderTasksAdmin(content) {
    content.innerHTML = '';
    const form = document.createElement('form');
    form.innerHTML = `
        <div class="form-group"><label>Nome:</label><input type="text" id="task-name" required></div>
        <div class="form-group"><label>Pontos:</label><input type="number" id="task-points" required></div>
        <div class="form-group"><label>Dia da Semana:</label><select id="task-day" required>
            <option value="Domingo">Domingo</option><option value="Segunda">Segunda</option><option value="Terça">Terça</option>
            <option value="Quarta">Quarta</option><option value="Quinta">Quinta</option><option value="Sexta">Sexta</option>
            <option value="Sábado">Sábado</option></select></div>
        <div class="form-group"><label>Usuário:</label><select id="task-user">${data.users.map(u => `<option value="${u.id}">${u.username}</option>`).join('')}</select></div>
        <button type="submit">Cadastrar</button>
    `;
    form.onsubmit = async (e) => {
        e.preventDefault();
        await fetchData();
        const name = document.getElementById('task-name').value;
        const points = parseInt(document.getElementById('task-points').value);
        const day = document.getElementById('task-day').value;
        const userId = parseInt(document.getElementById('task-user').value);
        const task = { id: data.tasks.length + 1, name, points, day, userId, completed: false };
        data.tasks.push(task);
        data.notifications.push({
            id: data.notifications.length + 1,
            userId: userId,
            message: `Nova tarefa: ${name} em ${day} por ${points} pontos.`,
            link: 'tasks',
            read: false,
            createdAt: new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
        });
        await saveData();
        renderNotificationsDropdown();
        renderTasksAdmin(content);
    };
    content.appendChild(form);

    const table = document.createElement('table');
    table.innerHTML = '<tr><th>Tarefa</th><th>Pontos</th><th>Dia</th><th>Usuário</th><th>Concluída</th><th>Ações</th></tr>';
    data.tasks.forEach(task => {
        const user = data.users.find(u => u.id === task.userId);
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${task.name}</td><td>${task.points}</td><td>${task.day}</td><td>${user.username}</td><td>${task.completed ? 'Sim' : 'Não'}</td>`;
        const td = document.createElement('td');
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Editar';
        editBtn.classList.add('edit-btn');
        editBtn.onclick = () => editItem('task', task.id);
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Excluir';
        deleteBtn.classList.add('delete-btn');
        deleteBtn.onclick = () => showModal(`Excluir tarefa ${task.name}?`, () => {
            deleteItem('task', task.id);
            closeModal();
        });
        td.append(editBtn, deleteBtn);
        tr.appendChild(td);
        table.appendChild(tr);
    });
    content.appendChild(table);
}

function renderProductsAdmin(content) {
    content.innerHTML = '';
    const form = document.createElement('form');
    form.innerHTML = `
        <div class="form-group"><label>Nome:</label><input type="text" id="product-name" required></div>
        <div class="form-group"><label>Pontos:</label><input type="number" id="product-points" required></div>
        <button type="submit">Cadastrar</button>
    `;
    form.onsubmit = async (e) => {
        e.preventDefault();
        await fetchData();
        const name = document.getElementById('product-name').value;
        const points = parseInt(document.getElementById('product-points').value);
        const product = { id: data.products.length + 1, name, points };
        data.products.push(product);
        data.users.filter(u => u.type === 'common').forEach(user => {
            data.notifications.push({
                id: data.notifications.length + 1,
                userId: user.id,
                message: `Novo produto: ${name} por ${points} pontos.`,
                link: 'products',
                read: false,
                createdAt: new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
            });
        });
        await saveData();
        renderNotificationsDropdown();
        renderProductsAdmin(content);
    };
    content.appendChild(form);

    const table = document.createElement('table');
    table.innerHTML = '<tr><th>Produto</th><th>Pontos</th><th>Ações</th></tr>';
    data.products.forEach(product => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${product.name}</td><td>${product.points}</td>`;
        const td = document.createElement('td');
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Editar';
        editBtn.classList.add('edit-btn');
        editBtn.onclick = () => editItem('product', product.id);
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Excluir';
        deleteBtn.classList.add('delete-btn');
        deleteBtn.onclick = () => showModal(`Excluir produto ${product.name}?`, () => {
            deleteItem('product', product.id);
            closeModal();
        });
        td.append(editBtn, deleteBtn);
        tr.appendChild(td);
        table.appendChild(tr);
    });
    content.appendChild(table);
}

function renderRequestsAdmin(content) {
    content.innerHTML = '';
    const filter = document.createElement('select');
    filter.innerHTML = `<option value="all">Todos</option><option value="Aguardando Avaliação">Aguardando</option><option value="Aprovado">Aprovados</option><option value="Rejeitado">Rejeitados</option>`;
    filter.onchange = () => renderRequestsAdmin(content);
    content.appendChild(filter);

    const statusFilter = filter.value === 'all' ? '' : filter.value;
    const table = document.createElement('table');
    table.innerHTML = '<tr><th>Produto</th><th>Usuário</th><th>Status</th><th>Criado</th><th>Moderado</th><th>Justificativa</th><th>Ações</th></tr>';
    data.requests.filter(r => !statusFilter || r.status === statusFilter).forEach(req => {
        const product = data.products.find(p => p.id === req.productId);
        const user = data.users.find(u => u.id === req.userId);
        const tr = document.createElement('tr');
        let iconClass = req.status === 'Aguardando Avaliação' ? 'fa-clock' : req.status === 'Aprovado' ? 'fa-check' : 'fa-times';
        tr.innerHTML = `
            <td><i class="fas ${iconClass} request-item"></i> ${product.name}</td>
            <td>${user.username}</td>
            <td>${req.status}</td>
            <td>${req.createdAt}</td>
            <td>${req.moderatedAt || '-'}</td>
            <td>${req.justification || '-'}</td>
        `;
        const td = document.createElement('td');
        if (req.status === 'Aguardando Avaliação') {
            const approveBtn = document.createElement('button');
            approveBtn.textContent = 'Aprovar';
            approveBtn.classList.add('approve-btn');
            approveBtn.onclick = () => approveRequest(req.id);
            const rejectBtn = document.createElement('button');
            rejectBtn.textContent = 'Rejeitar';
            rejectBtn.classList.add('reject-btn');
            rejectBtn.onclick = () => showJustifyModal(req.id);
            td.append(approveBtn, rejectBtn);
        }
        tr.appendChild(td);
        table.appendChild(tr);
    });
    content.appendChild(table);
}

async function approveRequest(id) {
    await fetchData();
    const req = data.requests.find(r => r.id === id);
    if (req) {
        req.status = 'Aprovado';
        req.moderatedAt = new Date().toLocaleDateString('pt-BR');
        const user = data.users.find(u => u.id === req.userId);
        const product = data.products.find(p => p.id === req.productId);
        user.currentPoints -= product.points;
        data.notifications.push({
            id: data.notifications.length + 1,
            userId: req.userId,
            message: `Solicitação de ${product.name} aprovada.`,
            link: 'requested-products',
            read: false,
            createdAt: new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
        });
        await saveData();
        renderNotificationsDropdown();
        updatePointsDisplay();
        showAdminTab('requests');
    }
}

function showJustifyModal(id) {
    rejectionId = id;
    document.getElementById('justify-modal').style.display = 'flex';
}

function closeJustifyModal() {
    document.getElementById('justify-modal').style.display = 'none';
}

async function confirmRejection() {
    const justify = document.getElementById('justify-text').value;
    if (!justify) {
        data.notifications.push({
            id: data.notifications.length + 1,
            userId: currentUser.id,
            message: 'Justificativa obrigatória.',
            read: false,
            createdAt: new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
        });
        await saveData();
        renderNotificationsDropdown();
        return;
    }
    await fetchData();
    const req = data.requests.find(r => r.id === rejectionId);
    if (req) {
        req.status = 'Rejeitado';
        req.justification = justify;
        req.moderatedAt = new Date().toLocaleDateString('pt-BR');
        const product = data.products.find(p => p.id === req.productId);
        data.notifications.push({
            id: data.notifications.length + 1,
            userId: req.userId,
            message: `Solicitação de ${product.name} rejeitada: ${justify}.`,
            link: 'requested-products',
            read: false,
            createdAt: new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
        });
        await saveData();
        closeJustifyModal();
        renderNotificationsDropdown();
        showAdminTab('requests');
    }
}

function renderRankingsAdmin(content) {
    content.innerHTML = '';
    const userRanking = document.createElement('div');
    userRanking.innerHTML = '<h3>Ranking de Usuários</h3>';
    const sortedUsers = [...data.users].sort((a, b) => b.totalPoints - a.totalPoints);
    const userTable = document.createElement('table');
    userTable.innerHTML = '<tr><th>Usuário</th><th>Pontos Totais</th></tr>';
    sortedUsers.forEach(user => {
        userTable.innerHTML += `<tr><td>${user.username}</td><td>${user.totalPoints}</td></tr>`;
    });
    userRanking.appendChild(userTable);
    content.appendChild(userRanking);

    const productRanking = document.createElement('div');
    productRanking.innerHTML = '<h3>Ranking de Produtos</h3>';
    const productCounts = data.products.map(p => ({
        ...p,
        exchanges: data.requests.filter(r => r.productId === p.id && r.status === 'Aprovado').length
    })).sort((a, b) => b.exchanges - a.exchanges);
    const productTable = document.createElement('table');
    productTable.innerHTML = '<tr><th>Produto</th><th>Trocas</th></tr>';
    productCounts.forEach(prod => {
        productTable.innerHTML += `<tr><td>${prod.name}</td><td>${prod.exchanges}</td></tr>`;
    });
    productRanking.appendChild(productTable);
    content.appendChild(productRanking);
}

function editItem(type, id) {
    editId = id;
    editType = type;
    const item = type === 'user' ? data.users.find(u => u.id === id) : type === 'task' ? data.tasks.find(t => t.id === id) : data.products.find(p => p.id === id);
    const form = document.getElementById('edit-form');
    form.innerHTML = '';
    if (type === 'user') {
        form.innerHTML = `
            <div class="form-group"><label>Username:</label><input type="text" id="edit-username" value="${item.username}" required></div>
            <div class="form-group"><label>Senha:</label><input type="password" id="edit-password" placeholder="Nova senha (opcional)"></div>
            <div class="form-group"><label>Tipo:</label><select id="edit-type"><option value="common" ${item.type === 'common' ? 'selected' : ''}>Comum</option><option value="admin" ${item.type === 'admin' ? 'selected' : ''}>Admin</option></select></div>
        `;
    } else if (type === 'task') {
        form.innerHTML = `
            <div class="form-group"><label>Nome:</label><input type="text" id="edit-task-name" value="${item.name}" required></div>
            <div class="form-group"><label>Pontos:</label><input type="number" id="edit-task-points" value="${item.points}" required></div>
            <div class="form-group"><label>Dia da Semana:</label><select id="edit-task-day" required>
                <option value="Domingo" ${item.day === 'Domingo' ? 'selected' : ''}>Domingo</option>
                <option value="Segunda" ${item.day === 'Segunda' ? 'selected' : ''}>Segunda</option>
                <option value="Terça" ${item.day === 'Terça' ? 'selected' : ''}>Terça</option>
                <option value="Quarta" ${item.day === 'Quarta' ? 'selected' : ''}>Quarta</option>
                <option value="Quinta" ${item.day === 'Quinta' ? 'selected' : ''}>Quinta</option>
                <option value="Sexta" ${item.day === 'Sexta' ? 'selected' : ''}>Sexta</option>
                <option value="Sábado" ${item.day === 'Sábado' ? 'selected' : ''}>Sábado</option>
            </select></div>
            <div class="form-group"><label>Usuário:</label><select id="edit-task-user">${data.users.map(u => `<option value="${u.id}" ${u.id === item.userId ? 'selected' : ''}>${u.username}</option>`).join('')}</select></div>
        `;
    } else {
        form.innerHTML = `
            <div class="form-group"><label>Nome:</label><input type="text" id="edit-product-name" value="${item.name}" required></div>
            <div class="form-group"><label>Pontos:</label><input type="number" id="edit-product-points" value="${item.points}" required></div>
        `;
    }
    document.getElementById('edit-modal').style.display = 'flex';
}

async function saveEdit() {
    await fetchData();
    if (editType === 'user') {
        const user = data.users.find(u => u.id === editId);
        user.username = document.getElementById('edit-username').value;
        const newPassword = document.getElementById('edit-password').value;
        if (newPassword) user.passwordHash = await hashPassword(newPassword);
        user.type = document.getElementById('edit-type').value;
    } else if (editType === 'task') {
        const task = data.tasks.find(t => t.id === editId);
        task.name = document.getElementById('edit-task-name').value;
        task.points = parseInt(document.getElementById('edit-task-points').value);
        task.day = document.getElementById('edit-task-day').value;
        task.userId = parseInt(document.getElementById('edit-task-user').value);
    } else {
        const product = data.products.find(p => p.id === editId);
        product.name = document.getElementById('edit-product-name').value;
        product.points = parseInt(document.getElementById('edit-product-points').value);
    }
    await saveData();
    closeEditModal();
    showAdminTab(editType + 's');
}

function closeEditModal() {
    document.getElementById('edit-modal').style.display = 'none';
}

async function deleteItem(type, id) {
    await fetchData();
    if (type === 'user') {
        if (data.users.find(u => u.id === id).type === 'admin' && data.users.filter(u => u.type === 'admin').length === 1) {
            data.notifications.push({
                id: data.notifications.length + 1,
                userId: currentUser.id,
                message: 'Não é possível excluir o último admin.',
                read: false,
                createdAt: new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
            });
            await saveData();
            renderNotificationsDropdown();
            return;
        }
        data.users = data.users.filter(u => u.id !== id);
        data.tasks = data.tasks.filter(t => t.userId !== id);
        data.requests = data.requests.filter(r => r.userId !== id);
        data.notifications = data.notifications.filter(n => n.userId !== id);
    } else if (type === 'task') {
        data.tasks = data.tasks.filter(t => t.id !== id);
    } else {
        data.products = data.products.filter(p => p.id !== id);
        data.requests = data.requests.filter(r => r.productId !== id);
    }
    await saveData();
    showAdminTab(type + 's');
}

function showModal(message, confirmCallback) {
    document.getElementById('modal-message').textContent = message;
    document.getElementById('modal-confirm').onclick = confirmCallback;
    document.getElementById('modal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('modal').style.display = 'none';
}
