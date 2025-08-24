// ... (Código anterior mantido, com adições abaixo)

// Inicialização (adicionar admin-btn visibility)
if (checkSession()) {
    // ...
    if (currentUser.type === 'admin') document.getElementById('admin-btn').style.display = 'inline-flex';
    renderNotificationsDropdown(); // Carrega notificações no dropdown
}

// Logout (renomeado para logout() para onclick)
function logout() {
    currentUser = null;
    localStorage.removeItem('session');
    location.reload();
}

// Render User Tabs (com ícones)
function renderUserTabs() {
    const tabs = document.getElementById('user-tabs');
    tabs.innerHTML = '';
    const tabData = [
        { label: 'Tarefas', icon: 'fa-list', tab: 'tasks' },
        { label: 'Produtos', icon: 'fa-shopping-bag', tab: 'products' },
        { label: 'Solicitados', icon: 'fa-box', tab: 'requested-products' },
        { label: 'Ranking', icon: 'fa-trophy', tab: 'ranking' }
    ];
    tabData.forEach(data => {
        const btn = document.createElement('button');
        btn.innerHTML = `<i class="fas ${data.icon}"></i> <span>${data.label}</span>`;
        btn.onclick = () => showUserTab(data.tab);
        tabs.appendChild(btn);
    });
}

// Render Admin Tabs (similar, com ícones opcionais)
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

// Toggle Notificações Dropdown
function toggleNotifications() {
    const list = document.getElementById('notifications-list');
    list.style.display = list.style.display === 'block' ? 'none' : 'block';
    renderNotificationsDropdown(); // Atualiza ao abrir
}

// Render Notificações no Dropdown
function renderNotificationsDropdown() {
    const list = document.getElementById('notifications-list');
    list.innerHTML = '';
    const ul = document.createElement('ul');
    const userNotifs = data.notifications.filter(n => n.userId === currentUser.id);
    userNotifs.forEach(notif => {
        const li = document.createElement('li');
        li.textContent = notif.message;
        li.onclick = () => {
            showUserTab(notif.link);
            toggleNotifications(); // Fecha dropdown após clique
        };
        ul.appendChild(li);
    });
    if (!userNotifs.length) {
        ul.innerHTML = '<li>Nenhuma notificação.</li>';
    }
    list.appendChild(ul);
}

// Render Requested Products (com ícones para status)
function renderRequestedProducts(content) {
    const list = document.createElement('ul');
    const userRequests = data.requests.filter(r => r.userId === currentUser.id);
    userRequests.forEach(req => {
        const product = data.products.find(p => p.id === req.productId);
        const li = document.createElement('li');
        let iconClass = '';
        if (req.status === 'Aguardando Avaliação') iconClass = 'fa-clock';
        else if (req.status === 'Aprovado') iconClass = 'fa-check';
        else if (req.status === 'Rejeitado') iconClass = 'fa-times';
        li.innerHTML = `<i class="fas ${iconClass} request-item"></i> ${product.name} - Status: ${req.status} - Criado: ${req.createdAt}`;
        if (req.status === 'Rejeitado') li.innerHTML += `<br>Justificativa: ${req.justification}`;
        if (req.moderatedAt) li.innerHTML += `<br>Moderado: ${req.moderatedAt}`;
        list.appendChild(li);
    });
    content.appendChild(list);
}

// ... (Restante do código anterior mantido, como fetchData, saveData, etc.)
