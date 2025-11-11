//MONGO_URI=mongodb+srv://guskaxdev1:uQ82dtH9dUYnR7iK@lucra-bet.0y6bpai.mongodb.net/?retryWrites=true&w=majority&appName=lucra-bet

document.addEventListener('DOMContentLoaded', () => {
    console.log('Verificando status de login...');
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    if (!isLoggedIn) {
        console.log('Usuário não está logado. Iniciando timer de 1 segundo para redirecionamento.');
        setTimeout(() => {
            console.log('Timer expirado. Redirecionando para login.html');
            window.location.href = '/login.html';
        }, 1000);
    } else {
        console.log('Usuário está logado. Acesso permitido.');
    }

    let editModal = null;
    let cancelModal = null;
    let editIdInput = null;
    let editNameInput = null;
    let editWhatsappInput = null;
    let editBalanceInput = null;
    let editExpirationInput = null;
    let editDaysRemainingInput = null;
    let editIndicationInput = null;
    let editDiscountInput = null;
    let cancelNameDisplay = null;
    let currentUserId = null;
    let allUsers = [];

    const tableBody = document.getElementById('usersTableBody');
    const totalUsersEl = document.getElementById('total-users');
    const totalBalanceEl = document.getElementById('total-balance');
    const activeSubscriptionsEl = document.getElementById('active-subscriptions');
    const expiredSubscriptionsEl = document.getElementById('expired-subscriptions');
    const sidebar = document.querySelector('.sidebar');
    const menuToggle = document.querySelector('.menu-toggle');
    const searchContainer = document.getElementById('search-container');
    const searchInput = document.getElementById('search-input');
    const usersTable = document.getElementById('usersTable');
    const logoutBtn = document.getElementById('logoutBtn');
    const loadingDiv = document.getElementById('loading');
    const errorDiv = document.getElementById('error');
    const filterExpiringBtn = document.getElementById('filter-expiring-btn');
    const addUserForm = document.getElementById('addUserForm');
    const saveNewUserBtn = document.getElementById('saveNewUserBtn');
    const usersHeaderControls = document.getElementById('users-header-controls');
    const chartsContainer = document.getElementById('charts-container');

    editModal = document.getElementById('editModal');
    cancelModal = document.getElementById('cancelModal');
    editIdInput = document.getElementById('edit-id');
    editNameInput = document.getElementById('edit-name');
    editWhatsappInput = document.getElementById('edit-whatsapp');
    editBalanceInput = document.getElementById('edit-balance');
    editExpirationInput = document.getElementById('edit-expiration');
    editDaysRemainingInput = document.getElementById('edit-days-remaining');
    editIndicationInput = document.getElementById('edit-indication');
    editDiscountInput = document.getElementById('edit-discount');
    cancelNameDisplay = document.getElementById('cancel-name');

    // --- FUNÇÕES DE CARREGAMENTO DE DADOS ---
    async function fetchData(url) {
        showLoading();
        try {
            const response = await fetch(url, { credentials: 'include', mode: 'cors' });
            if (!response.ok) {
                if (response.status === 401) { // Não autorizado
                    window.location.href = '/login.html';
                }
                throw new Error(`Erro na requisição: ${response.statusText}`);
            }
            const data = await response.json();
            allUsers = data.users || [];
            updateDashboardStats(data);
            return data;
        } catch (error) {
            console.error('Erro ao buscar dados:', error);
            showError(`Erro ao carregar dados: ${error.message}`);
            return { users: [] };
        } finally {
            hideLoading();
        }
    }

    if (!tableBody || !totalUsersEl || !totalBalanceEl || !activeSubscriptionsEl || !expiredSubscriptionsEl || !sidebar || !menuToggle || !searchContainer || !searchInput || !usersTable || !logoutBtn || !editModal || !cancelModal || !editIdInput || !editNameInput || !editBalanceInput || !editExpirationInput || !editDaysRemainingInput || !editIndicationInput || !cancelNameDisplay || !loadingDiv || !errorDiv) {
        console.error('Erro: Um ou mais elementos DOM não foram encontrados:', {
            tableBody, totalUsersEl, totalBalanceEl, activeSubscriptionsEl, expiredSubscriptionsEl, sidebar, menuToggle, searchContainer, searchInput, usersTable, logoutBtn, editModal, cancelModal, editIdInput, editNameInput, editBalanceInput, editExpirationInput, editDaysRemainingInput, editIndicationInput, cancelNameDisplay, loadingDiv, errorDiv
        });
        return;
    }

    menuToggle.addEventListener('click', () => sidebar.classList.toggle('active'));
    logoutBtn.addEventListener('click', handleLogout);

    // Evento para o novo botão de filtro de expiração
    filterExpiringBtn.addEventListener('click', () => {
        console.log('Botão "Expirando em Breve" clicado.');
        
        const expiringUsers = allUsers.filter(user => {
            return user.daysRemaining > 0 && user.daysRemaining <= 7;
        });
    
        // --- LINHA ADICIONADA PARA ORDENAR ---
        // Ordena a lista em ordem crescente com base nos dias restantes
        expiringUsers.sort((a, b) => a.daysRemaining - b.daysRemaining);
        // ------------------------------------
    
        const sectionTitle = document.getElementById('users-section-title');
        if (sectionTitle) {
            sectionTitle.textContent = `Usuários Expirando (${expiringUsers.length})`;
        }
        
        if (expiringUsers.length === 0) {
            const tableBody = document.getElementById('usersTableBody');
            populateAllUsersTable([]); 
            tableBody.innerHTML = '<tr><td colspan="10">Nenhum usuário expirando em breve.</td></tr>';
        } else {
            // Popula a tabela com a lista agora filtrada E ordenada
            populateAllUsersTable(expiringUsers);
        }
    
        console.log(`${expiringUsers.length} usuários encontrados expirando em breve.`);
    });

     // Evento para quando o campo "Dias Restantes" é alterado
     editDaysRemainingInput.addEventListener('input', () => {
        const days = parseInt(editDaysRemainingInput.value, 10);
    
        if (isNaN(days) || days < 0) {
            editExpirationInput.value = '';
            return;
        }
    
        // --- INÍCIO DA CORREÇÃO ---
        // Pega a data de hoje em UTC para manter a consistência com o outro cálculo
        const today = new Date();
        const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    
        // Adiciona os dias ao timestamp UTC. getTime() retorna milissegundos desde a Época UTC.
        // (dias * 24 horas * 60 minutos * 60 segundos * 1000 milissegundos)
        const newExpirationTimestamp = todayUTC.getTime() + (days * 24 * 60 * 60 * 1000);
        
        // Cria a nova data a partir do timestamp UTC
        const newExpirationDate = new Date(newExpirationTimestamp);
    
        // Formata a data para YYYY-MM-DD usando os métodos UTC para garantir a precisão
        const year = newExpirationDate.getUTCFullYear();
        const month = String(newExpirationDate.getUTCMonth() + 1).padStart(2, '0');
        const day = String(newExpirationDate.getUTCDate()).padStart(2, '0');
        // --- FIM DA CORREÇÃO ---
        
        editExpirationInput.value = `${year}-${month}-${day}`;
    });

    editExpirationInput.addEventListener('change', () => {
        console.log("Evento 'change' disparado. Novo valor:", editExpirationInput.value);
        updateDaysRemaining(editExpirationInput.value);
    });
    
    // Adiciona um segundo evento 'input' para garantir a atualização imediata
    editExpirationInput.addEventListener('input', () => {
        console.log("Evento 'input' disparado. Novo valor:", editExpirationInput.value);
        updateDaysRemaining(editExpirationInput.value);
    });

    // Localize este bloco no seu script.js e substitua-o
    const navLinks = document.querySelectorAll('.sidebar-nav a');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            // LÓGICA CORRIGIDA: Lendo o atributo data-view em vez do texto
            const view = link.dataset.view; // Pega o valor de "data-view"

            // O viewMap agora usa as chaves do data-view
            const viewMap = {
                'dashboard': loadDashboard,
                'users': loadUsers,
                'registered': loadRegisteredUsers,
                'active': loadActiveUsers,
                'inactive': loadInactiveUsers,
            };

            if (viewMap[view]) {
                viewMap[view]();
            } else if (view === 'logout') {
                handleLogout();
            }

            // Esconde a barra lateral em telas pequenas após o clique
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('active');
            }
        });
    });

    function loadDashboard() {
        console.log('Carregando Dashboard...');
        showLoading();
        
        const detailCards = document.querySelectorAll('.dashboard-only-card');
        detailCards.forEach(card => card.style.display = 'block');
        chartsContainer.style.display = 'grid'; 
        usersHeaderControls.style.display = 'none';
        searchContainer.style.display = 'none';
        usersTable.style.display = 'none';
    
        // O resto da sua função fetch continua igual
        fetch('https://lucra-bet.up.railway.app/users', {
            credentials: 'include',
            mode: 'cors'
        })
        .then(response => {
            if (!response.ok) throw new Error(`Erro na requisição: ${response.statusText}`);
            return response.json();
        })
        .then(data => {
            hideLoading();
            allUsers = data.users || [];
            updateDashboardStats(data);
        })
        .catch(error => {
            hideLoading();
            showError(`Erro ao carregar dados do Dashboard: ${error.message}`);
        });
    }
    async function loadUsers() {
        console.log('Carregando Usuários...');
        showLoading();
        
        const detailCards = document.querySelectorAll('.dashboard-only-card');
        detailCards.forEach(card => card.style.display = 'none');
        chartsContainer.style.display = 'none';
        usersHeaderControls.style.display = 'flex'; // <-- LINHA ADICIONADA
        searchContainer.style.display = 'block';
        usersTable.style.display = 'table';
        
        // O resto da sua função fetch continua igual
        fetch('https://lucra-bet.up.railway.app/users', {
            credentials: 'include',
            mode: 'cors'
        })
        .then(response => {
            if (!response.ok) throw new Error(`Erro na requisição: ${response.statusText}`);
            return response.json();
        })
        .then(data => {
            hideLoading();
            allUsers = data.users || [];
            updateDashboardStats(data);
            populateAllUsersTable(allUsers);
            populateIndicationDatalist();
        })
        .catch(error => {
            hideLoading();
            showError(`Erro ao carregar usuários: ${error.message}`);
        });
    }

    function loadRegisteredUsers() {
        console.log('Carregando Usuários Registrados...');
        showLoading();

        const detailCards = document.querySelectorAll('.dashboard-only-card');
        detailCards.forEach(card => card.style.display = 'none');
        chartsContainer.style.display = 'none';
        usersHeaderControls.style.display = 'flex'; // <-- LINHA ADICIONADA
        searchContainer.style.display = 'block';
        usersTable.style.display = 'table';
        fetch('https://lucra-bet.up.railway.app/users', {
            credentials: 'include',
            mode: 'cors'
        })
        .then(response => {
            console.log('Resposta do servidor para Usuários Registrados:', {
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries())
            });
            if (!response.ok) {
                throw new Error(`Erro na requisição: ${response.status} - ${response.statusText}`);
            }
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                return response.text().then(text => {
                    throw new Error(`Resposta não é JSON: ${text.substring(0, 50)}...`);
                });
            }
            return response.json();
        })
        .then(data => {
            console.log('Dados brutos recebidos:', data);
            hideLoading();
            if (!data || !data.users || data.users.length === 0) {
                console.warn('Nenhum usuário encontrado ou dados inválidos:', data);
                tableBody.innerHTML = '<tr><td colspan="9">Nenhum usuário registrado encontrado.</td></tr>';
                updateDashboardStats(data);
                return;
            }
            allUsers = data.users;
            const registeredUsers = data.users.filter(user => {
                const hasNoPaymentHistory = !user.paymentHistory || user.paymentHistory.length === 0;
                const hasNoExpiration = !user.expirationDate;
                return hasNoPaymentHistory && hasNoExpiration;
            });
            if (registeredUsers.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="9">Nenhum usuário registrado encontrado.</td></tr>';
            } else {
                populateRegisteredUsersTable(registeredUsers);
            }
            updateDashboardStats(data);
            console.log('Usuários registrados carregados:', registeredUsers);
        })
        .catch(error => {
            hideLoading();
            console.error('Erro ao carregar dados:', error);
            tableBody.innerHTML = `<tr><td colspan="9">Erro: ${error.message}</td></tr>`;
            updateDashboardStats([]);
            showError(`Erro ao carregar usuários registrados: ${error.message}`);
            alert(`Erro ao carregar usuários registrados: ${error.message}`);
        });
    }
    // Adicione esta nova função ao seu script.js
    async function loadChartData() {
        try {
            const response = await fetch('https://lucra-bet.up.railway.app/api/charts-data', { credentials: 'include', mode: 'cors' });
            if (!response.ok) {
                throw new Error('Falha ao buscar dados dos gráficos');
            }
            const chartData = await response.json();

            // --- GRÁFICO DE LINHA: ASSINATURAS PAGAS ---
            const ctxAssinaturas = document.getElementById('assinaturasChart').getContext('2d');
            new Chart(ctxAssinaturas, {
                type: 'line',
                data: {
                    labels: chartData.dailyPayments.labels,
                    datasets: [{
                        label: 'Assinaturas Pagas',
                        data: chartData.dailyPayments.data,
                        borderColor: 'rgba(54, 162, 235, 1)',
                        backgroundColor: 'rgba(54, 162, 235, 0.2)',
                        fill: true,
                        tension: 0.4, // Deixa a linha mais suave
                        pointBackgroundColor: '#fff',
                        pointBorderColor: 'rgba(54, 162, 235, 1)',
                        pointHoverRadius: 7,
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
            // --- GRÁFICO DE BARRA: FATURAMENTO MENSAL ---
            const ctxFaturamento = document.getElementById('faturamentoChart').getContext('2d');
            new Chart(ctxFaturamento, {
                type: 'bar',
                data: {
                    labels: chartData.monthlyRevenue.labels,
                    datasets: [{
                        label: 'Faturamento R$',
                        data: chartData.monthlyRevenue.data,
                        backgroundColor: 'rgba(75, 192, 192, 0.6)',
                        borderColor: 'rgba(75, 192, 192, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value, index, values) {
                                    return 'R$ ' + value.toLocaleString('pt-BR');
                                }
                            }
                        }
                    }
                }
            });

        } catch (error) {
            console.error("Erro ao carregar dados dos gráficos:", error);
        } 
    }
    
    function loadActiveUsers() {
        console.log('Filtrando Usuários Ativos...');

        const detailCards = document.querySelectorAll('.dashboard-only-card');
        detailCards.forEach(card => card.style.display = 'none');
        chartsContainer.style.display = 'none';
        usersHeaderControls.style.display = 'flex'; // <-- LINHA ADICIONADA
        searchContainer.style.display = 'block';
        usersTable.style.display = 'table'
        
        // Filtra a lista que já temos na memória
        const activeUsers = allUsers.filter(user => {
            if (!user.expirationDate) return false;
            const expDate = new Date(user.expirationDate);
            return !isNaN(expDate.getTime()) && expDate > new Date();
        });
    
        populateActiveUsersTable(activeUsers);
        console.log('Usuários ativos exibidos:', activeUsers);
    }

    function loadInactiveUsers() {
        console.log('Carregando Usuários Inativos...');
        showLoading();

        const detailCards = document.querySelectorAll('.dashboard-only-card');
        detailCards.forEach(card => card.style.display = 'none');
        chartsContainer.style.display = 'none';
        usersHeaderControls.style.display = 'flex'; // <-- LINHA ADICIONADA
        searchContainer.style.display = 'block';
        usersTable.style.display = 'table'
        fetch('https://lucra-bet.up.railway.app/users', {
            credentials: 'include',
            mode: 'cors'
        })
        .then(response => {
            console.log('Resposta do servidor para Usuários Inativos:', {
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries())
            });
            if (!response.ok) {
                throw new Error(`Erro na requisição: ${response.status} - ${response.statusText}`);
            }
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                return response.text().then(text => {
                    throw new Error(`Resposta não é JSON: ${text.substring(0, 50)}...`);
                });
            }
            return response.json();
        })
        .then(data => {
            console.log('Dados brutos recebidos:', data);
            hideLoading();
            if (!data || !data.users || data.users.length === 0) {
                console.warn('Nenhum usuário encontrado ou dados inválidos:', data);
                tableBody.innerHTML = '<tr><td colspan="9">Nenhum usuário inativo encontrado.</td></tr>';
                updateDashboardStats(data);
                return;
            }
            allUsers = data.users;
            const inactiveUsers = data.users.filter(user => {
                if (!user.expirationDate) return true;
                const expDate = new Date(user.expirationDate);
                return isNaN(expDate.getTime()) || expDate <= new Date();
            });
            if (inactiveUsers.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="9">Nenhum usuário inativo encontrado.</td></tr>';
            } else {
                populateInactiveUsersTable(inactiveUsers);
            }
            updateDashboardStats(data);
            console.log('Usuários inativos carregados:', inactiveUsers);
        })
        .catch(error => {
            hideLoading();
            console.error('Erro ao carregar dados:', error);
            tableBody.innerHTML = `<tr><td colspan="9">Erro: ${error.message}</td></tr>`;
            updateDashboardStats([]);
            showError(`Erro ao carregar usuários inativos: ${error.message}`);
            alert(`Erro ao carregar usuários inativos: ${error.message}`);
        });
    }

    function updateDashboardStats(data) {
        const users = data.users || [];
        
        // Elementos do DOM
        const totalUsersEl = document.getElementById('total-users');
        const totalBalanceEl = document.getElementById('total-balance');
        const activeSubscriptionsEl = document.getElementById('active-subscriptions');
        const expiredSubscriptionsEl = document.getElementById('expired-subscriptions');
        const paidInvoicesCountEl = document.getElementById('paid-invoices-count');
        const averagePaymentValueEl = document.getElementById('average-payment-value');
    
        // Dados do backend
        const totalUsers = users.length;
        const totalBalance = data.totalBalanceFromHistory || '0.00';
        const activeSubscriptions = users.filter(u => u.daysRemaining > 0).length;
        const expiredSubscriptions = totalUsers - activeSubscriptions;
        const paidInvoicesCount = data.paidInvoicesCount || 0;
        const averagePaymentValue = data.averagePaymentValue || '0.00';
    
        // Atualiza o conteúdo dos elementos
        totalUsersEl.textContent = totalUsers;
        totalBalanceEl.textContent = parseFloat(totalBalance).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        activeSubscriptionsEl.textContent = activeSubscriptions;
        expiredSubscriptionsEl.textContent = expiredSubscriptions;
        paidInvoicesCountEl.textContent = paidInvoicesCount;
        averagePaymentValueEl.textContent = parseFloat(averagePaymentValue).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        
        console.log('Estatísticas atualizadas:', {
        });
    }
    function populateIndicationDatalist() {
        const indicationDatalist = document.getElementById('indication-options');
        if (indicationDatalist) {
            const uniqueIndications = [...new Set(allUsers.map(user => user.indication).filter(Boolean))];
            indicationDatalist.innerHTML = '<option value="Nenhum"></option>';
            uniqueIndications.forEach(indication => {
                const option = document.createElement('option');
                option.value = indication;
                indicationDatalist.appendChild(option);
            });
        }
    }
function populateAllUsersTable(users) {
    const tableHeader = document.querySelector('#usersTable thead');
    tableHeader.innerHTML = `
        <tr>
            <th>ID Discord</th> <th>Nome</th> <th>WhatsApp</th> <th>Saldo</th> <th>Desconto</th>
            <th>Último Pag.</th> <th>Expiração</th> <th>Status</th> <th>Dias Rest.</th> <th>Ações</th>
        </tr>`;
    tableBody.innerHTML = '';
    if (users.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="10">Nenhum usuário encontrado.</td></tr>';
        return;
    }
    users.forEach(user => {
        const row = document.createElement('tr');
        // --- CORREÇÃO APLICADA AQUI ---
        if (user.indication && user.indication !== 'Nenhum' && user.indication !== 'Nenhuma') {
            row.classList.add('indicated-user');
        }
        const escapedName = user.name ? user.name.replace(/'/g, "\\'") : '-';
        
        let lastPaymentInfo = '-';
        if (user.lastPaymentDate) {
            const amount = (user.lastPaymentAmount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            const date = new Date(user.lastPaymentDate).toLocaleDateString('pt-BR');
            lastPaymentInfo = `${amount} (${date})`;
        }

        // Bloco de correção da data (que você já tem)
        let formattedExpirationDate = '-';
        if (user.expirationDate) {
            const date = new Date(user.expirationDate);
            const userTimezoneOffset = date.getTimezoneOffset() * 60000;
            const correctedDate = new Date(date.getTime() + userTimezoneOffset);
            formattedExpirationDate = correctedDate.toLocaleDateString('pt-BR');
        }
        
        row.innerHTML = `
            <td>${user.userId || '-'}</td>
            <td>${user.name || '-'}</td>
            <td>${user.whatsapp || '-'}</td>
            <td>${(user.balance || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
            <td>${(user.discount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
            <td>${lastPaymentInfo}</td>
            
            <td>${formattedExpirationDate}</td> 
            
            <td>${user.daysRemaining > 0 ? '<span class="status-active">Ativo</span>' : '<span class="status-inactive">Inativo</span>'}</td>
            <td>${user.daysRemaining > 0 ? `${user.daysRemaining} dias` : '-'}</td>
            <td>
                <button class="action-btn edit-btn" data-user-id="${user.userId}" data-name="${escapedName}" data-whatsapp="${user.whatsapp || ''}" data-balance="${user.balance || 0}" data-discount="${user.discount || 0}" data-expiration="${user.expirationDate || ''}" data-indication="${user.indication || 'Nenhum'}">
                    <i class="fas fa-edit"></i> Editar
                </button>
                <button class="action-btn delete-btn" data-user-id="${user.userId}" data-name="${escapedName}">
                    <i class="fas fa-trash"></i> Excluir
                </button>
            </td>`;
        tableBody.appendChild(row);
    });
}

function populateRegisteredUsersTable(users) {
    const tableHeader = document.querySelector('#usersTable thead');
    const tableBody = document.getElementById('usersTableBody');
    
    tableHeader.innerHTML = `
        <tr>
            <th>ID Discord</th>
            <th>Nome</th>
            <th>WhatsApp</th>
            <th>Data de Registro</th>
            <th>Ações</th>
        </tr>
    `;

    tableBody.innerHTML = '';
    if (users.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5">Nenhum usuário apenas registrado encontrado.</td></tr>';
        return;
    }

    users.forEach(user => {
        const row = document.createElement('tr');
        // --- CORREÇÃO APLICADA AQUI ---
        if (user.indication && user.indication !== 'Nenhum' && user.indication !== 'Nenhuma') {
            row.classList.add('indicated-user');
        }
        const escapedName = user.name ? user.name.replace(/'/g, "\\'") : '-';

        row.innerHTML = `
            <td>${user.userId || '-'}</td>
            <td>${user.name || '-'}</td>
            <td>${user.whatsapp || '-'}</td>
            <td>${user.registeredAt ? new Date(user.registeredAt).toLocaleDateString('pt-BR') : '-'}</td>
            <td>
                <button class="action-btn edit-btn" data-user-id="${user.userId}" data-name="${escapedName}" data-whatsapp="${user.whatsapp || ''}" data-balance="${user.balance || 0}" data-discount="${user.discount || 0}" data-expiration="${user.expirationDate || ''}" data-indication="${user.indication || 'Nenhum'}">
                    <i class="fas fa-edit"></i> Editar
                </button>
                <button class="action-btn delete-btn" data-user-id="${user.userId}" data-name="${escapedName}">
                    <i class="fas fa-trash"></i> Excluir
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function populateActiveUsersTable(users) {
    const tableHeader = document.querySelector('#usersTable thead');
    const tableBody = document.getElementById('usersTableBody');
    
    tableHeader.innerHTML = `
        <tr>
            <th>ID Discord</th>
            <th>Nome</th>
            <th>WhatsApp</th>
            <th>Saldo</th>
            <th>Desconto</th>
            <th>Último Pag.</th>
            <th>Expiração</th>
            <th>Dias Rest.</th>
            <th>Ações</th>
        </tr>
    `;

    tableBody.innerHTML = '';
    if (users.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="9">Nenhum usuário ativo encontrado.</td></tr>';
        return;
    }

    users.forEach(user => {
        const row = document.createElement('tr');
        // --- CORREÇÃO APLICADA AQUI ---
        if (user.indication && user.indication !== 'Nenhum' && user.indication !== 'Nenhuma') {
            row.classList.add('indicated-user');
        }
        const escapedName = user.name ? user.name.replace(/'/g, "\\'") : '-';
        
        let lastPaymentInfo = '-';
        if (user.lastPaymentDate) {
            const amount = (user.lastPaymentAmount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            const date = new Date(user.lastPaymentDate).toLocaleDateString('pt-BR');
            lastPaymentInfo = `${amount} (${date})`;
        }

        row.innerHTML = `
            <td>${user.userId || '-'}</td>
            <td>${user.name || '-'}</td>
            <td>${user.whatsapp || '-'}</td>
            <td>${(user.balance || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
            <td>${(user.discount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
            <td>${lastPaymentInfo}</td>
            <td>${user.expirationDate ? new Date(user.expirationDate).toLocaleDateString('pt-BR') : '-'}</td>
            <td>${user.daysRemaining > 0 ? `${user.daysRemaining} dias` : '-'}</td>
            <td>
                <button class="action-btn edit-btn" data-user-id="${user.userId}" data-name="${escapedName}" data-whatsapp="${user.whatsapp || ''}" data-balance="${user.balance || 0}" data-discount="${user.discount || 0}" data-expiration="${user.expirationDate || ''}" data-indication="${user.indication || 'Nenhum'}">
                    <i class="fas fa-edit"></i> Editar
                </button>
                <button class="action-btn delete-btn" data-user-id="${user.userId}" data-name="${escapedName}">
                    <i class="fas fa-trash"></i> Excluir
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function populateInactiveUsersTable(users) {
    const tableHeader = document.querySelector('#usersTable thead');
    const tableBody = document.getElementById('usersTableBody');
    
    tableHeader.innerHTML = `
        <tr>
            <th>ID Discord</th>
            <th>Nome</th>
            <th>WhatsApp</th>
            <th>Último Pag.</th>
            <th>Dias Inativo</th>
            <th>Ações</th>
        </tr>
    `;

    tableBody.innerHTML = '';
    if (users.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6">Nenhum usuário inativo encontrado.</td></tr>';
        return;
    }

    users.forEach(user => {
        const row = document.createElement('tr');
        // --- CORREÇÃO APLICADA AQUI ---
        if (user.indication && user.indication !== 'Nenhum' && user.indication !== 'Nenhuma') {
            row.classList.add('indicated-user');
        }
        const escapedName = user.name ? user.name.replace(/'/g, "\\'") : '-';
        
        let lastPaymentInfo = '-';
        if (user.lastPaymentDate) {
            const amount = (user.lastPaymentAmount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            const date = new Date(user.lastPaymentDate).toLocaleDateString('pt-BR');
            lastPaymentInfo = `${amount} (${date})`;
        }

        row.innerHTML = `
            <td>${user.userId || '-'}</td>
            <td>${user.name || '-'}</td>
            <td>${user.whatsapp || '-'}</td>
            <td>${lastPaymentInfo}</td>
            <td>${user.daysInactive > 0 ? `${user.daysInactive} dias` : 'N/A'}</td>
            <td>
                <button class="action-btn edit-btn" data-user-id="${user.userId}" data-name="${escapedName}" data-whatsapp="${user.whatsapp || ''}" data-balance="${user.balance || 0}" data-discount="${user.discount || 0}" data-expiration="${user.expirationDate || ''}" data-indication="${user.indication || 'Nenhum'}">
                    <i class="fas fa-edit"></i> Editar
                </button>
                <button class="action-btn delete-btn" data-user-id="${user.userId}" data-name="${escapedName}">
                    <i class="fas fa-trash"></i> Excluir
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

searchInput.addEventListener('input', () => {
    const searchTerm = searchInput.value.toLowerCase();
    console.log('Busca iniciada com termo:', searchTerm);
    const filteredUsers = allUsers.filter(user => {
        return (user.userId && user.userId.toLowerCase().includes(searchTerm)) ||
               (user.name && user.name.toLowerCase().includes(searchTerm));
    });
    populateAllUsersTable(filteredUsers);
    console.log('Tabela filtrada com:', filteredUsers);
});

const saveChangesBtn = document.querySelector('#editModal .save-btn');
if (saveChangesBtn) {
    saveChangesBtn.addEventListener('click', () => {
        console.log('Botão "Salvar Alterações" clicado para userId:', currentUserId);
        if (!currentUserId) {
            console.error('Erro: currentUserId não definido');
            alert('Erro: ID do usuário não encontrado.');
            return;
        }
        const name = editNameInput.value;
        const whatsapp = editWhatsappInput.value;
        const balance = parseFloat(editBalanceInput.value) || 0;
        const discount = parseFloat(editDiscountInput.value) || 0; // Pega o valor do novo campo
        const expirationDate = editExpirationInput.value || null;

        // --- CORREÇÃO APLICADA AQUI ---
        // Pega o valor do input e normaliza para null se for "Nenhum" ou "Nenhuma"
        let indicationValue = editIndicationInput.value.trim();
        const indication = (indicationValue.toLowerCase() === 'nenhum' || indicationValue.toLowerCase() === 'nenhuma' || indicationValue === '') 
                           ? null 
                           : indicationValue;

        const requestBody = { name, whatsapp,balance, discount, expirationDate, indication }; // Adiciona o desconto no corpo da requisição

        console.log('Enviando requisição PUT com:', requestBody);
        fetch(`https://lucra-bet.up.railway.app/user/${currentUserId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            mode: 'cors',
            body: JSON.stringify(requestBody)
        })
        .then(response => {
            console.log('Resposta do servidor ao salvar:', {
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries())
            });
            if (!response.ok) {
                return response.text().then(text => {
                    throw new Error(`Erro: ${response.status} - ${text || response.statusText}`);
                });
            }
            return response.json();
        })
        .then(data => {
            console.log('Dados retornados após salvar:', JSON.stringify(data, null, 2));
            if (data.error) throw new Error(data.error);
            alert('Sucesso: Dados atualizados!');
            $(editModal).modal('hide');
            loadUsers(); 
        })
        .catch(error => {
            console.error('Erro ao salvar:', error);
            alert(`Erro ao atualizar dados: ${error.message}`);
        });
    });
} else {
    console.error('Erro: Botão "Salvar Alterações" não encontrado');
}

$(editModal).on('hidden.bs.modal', () => {
    currentUserId = null;
    console.log('Modal de edição fechado');
});

$(cancelModal).on('hidden.bs.modal', () => {
    currentUserId = null;
    console.log('Modal de cancelamento fechado');
});

function showLoading() {
    loadingDiv.style.display = 'block';
    errorDiv.style.display = 'none';
    console.log('Exibindo estado de carregamento');
}

function hideLoading() {
    loadingDiv.style.display = 'none';
    console.log('Ocultando estado de carregamento');
}

function showError(message) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    console.log('Erro exibido:', message);
}

function handleLogout() {
    console.log('Logout solicitado');
    fetch('https://lucra-bet.up.railway.app/logout', {
        method: 'POST',
        credentials: 'include',
        mode: 'cors'
    })
    .then(response => {
        console.log('Resposta do logout:', { status: response.status, statusText: response.statusText });
        return response.json().catch(() => ({}));
    })
    .then(data => {
        console.log('Dados do logout:', data);
    })
    .catch(error => {
        console.error('Erro ao fazer logout:', error.message);
    })
    .finally(() => {
        localStorage.removeItem('isLoggedIn');
        console.log('isLoggedIn removido do localStorage');
        window.location.href = '/login.html';
    });
}

logoutBtn.addEventListener('click', handleLogout);

tableBody.addEventListener('click', (e) => {
    const targetButton = e.target.closest('.action-btn');
    if (!targetButton) return;

    const userId = targetButton.dataset.userId;
    const name = targetButton.dataset.name.replace(/\\'/g, "'");

    if (targetButton.classList.contains('edit-btn')) {
        console.log('Clicou em Editar para userId:', userId);
        const whatsapp = targetButton.dataset.whatsapp;
        const balance = parseFloat(targetButton.dataset.balance) || 0;
        const expirationDate = targetButton.dataset.expiration;
        const discount = parseFloat(targetButton.dataset.discount) || 0;
        const indication = targetButton.dataset.indication || '';
        
        // Chama a função global para abrir o modal
        window.openEditModal(userId, name, whatsapp, balance, discount, expirationDate, indication);
    } else if (targetButton.classList.contains('delete-btn')) {
        console.log('Clicou em Excluir para userId:', userId);
        window.openCancelModal(userId, name);
    }
});

// Função 1: A que abre o modal
window.openEditModal = function(userId, name, whatsapp, balance, discount, expirationDate, indication) {
    if (!editModal) return;
    currentUserId = userId;
    editIdInput.value = userId || '-';
    editNameInput.value = name || '-';
    editWhatsappInput.value = whatsapp || '';
    editBalanceInput.value = (balance || 0).toFixed(2);
    editDiscountInput.value = (discount || 0).toFixed(2);
    
    let initialExpiration = '';
    if (expirationDate && expirationDate !== 'null') {
        try {
            const expDate = new Date(expirationDate);
            if (!isNaN(expDate.getTime())) {
                initialExpiration = expDate.toISOString().split('T')[0];
            }
        } catch (err) {}
    }
    
    editExpirationInput.value = initialExpiration;
    updateDaysRemaining(initialExpiration);
    editIndicationInput.value = indication || 'Nenhum';
    
    const modal = bootstrap.Modal.getOrCreateInstance(editModal);
    modal.show();
};

function updateDaysRemaining(expirationDate) {
    if (!editDaysRemainingInput) return;
    if (!expirationDate) {
        editDaysRemainingInput.value = 0;
        return;
    }

    // --- INÍCIO DA CORREÇÃO ---
    // Pega a data de hoje e a data de expiração em UTC para evitar problemas de fuso horário
    const today = new Date();
    const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

    // A data de expiração vem como string 'YYYY-MM-DD'. Precisamos convertê-la para UTC.
    const expDateParts = expirationDate.split('-'); // Divide a string em [YYYY, MM, DD]
    const expDateUTC = new Date(Date.UTC(expDateParts[0], expDateParts[1] - 1, expDateParts[2])); // O mês em JS é de 0 a 11
    // --- FIM DA CORREÇÃO ---

    const diffTime = expDateUTC - todayUTC; // Calcula a diferença em UTC
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    editDaysRemainingInput.value = daysRemaining > 0 ? daysRemaining : 0;
}

// Listener para o botão SALVAR do modal de ADIÇÃO (movido para dentro do DOMContentLoaded)
saveNewUserBtn.addEventListener('click', async () => {
    const userId = document.getElementById('newUserId').value.trim();
    const name = document.getElementById('newUserName').value.trim();
    const whatsapp = document.getElementById('newUserWhatsapp').value.trim();
    const expirationDate = document.getElementById('newUserExpiration').value;

    if (!userId || !name || !whatsapp) {
        alert('ID do Discord, Nome e WhatsApp são obrigatórios.');
        return;
    }

    const userData = { userId, name, whatsapp };
    if (expirationDate) userData.expirationDate = expirationDate;

    try {
        const response = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData),
        });
        const result = await response.json();
        if (response.ok) {
            alert(result.message);
            const addUserModal = bootstrap.Modal.getInstance(document.getElementById('addUserModal'));
            addUserModal.hide();
            addUserForm.reset();
            loadUsers();
        } else {
            alert(`Erro: ${result.message}`);
        }
    } catch (error) {
        alert('Ocorreu um erro de comunicação com a API.');
    }
});


window.openCancelModal = function(userId, name) {
    console.log('Abrindo modal de cancelamento:', { userId, name });
    if (!cancelModal || !cancelNameDisplay) {
        console.error('Erro: Elementos do modal de cancelamento não foram encontrados');
        return;
    }
    currentUserId = userId;
    cancelNameDisplay.textContent = name || '-';
    $(cancelModal).modal('show');
    console.log('Modal de cancelamento exibido');

    const deleteAllBtn = document.querySelector('#cancelModal .delete-all-btn');
    if (deleteAllBtn) {
        deleteAllBtn.removeEventListener('click', handleDeleteAll); // Remover evento anterior
        deleteAllBtn.addEventListener('click', handleDeleteAll, { once: true });
        console.log('Evento de clique associado ao botão "Excluir Todos os Dados"');
    } else {
        console.error('Erro: Botão "Excluir Todos os Dados" não encontrado');
    }
};

function handleDeleteAll() {
    console.log('Botão "Excluir Todos os Dados" clicado para userId:', currentUserId);
    if (!currentUserId) {
        console.error('Erro: currentUserId não definido');
        alert('Erro: ID do usuário não encontrado.');
        return;
    }
    if (!confirm('Tem certeza que deseja excluir TODOS os dados deste usuário? Esta ação não pode ser desfeita.')) {
        console.log('Exclusão cancelada pelo usuário');
        return;
    }
    fetch(`https://lucra-bet.up.railway.app/user/${currentUserId}/all`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        mode: 'cors'
    })
    .then(response => {
        if (!response.ok) {
            return response.text().then(text => { throw new Error(`Erro: ${response.status} - ${text || response.statusText}`); });
        }
        return response.json();
    })
    .then(data => {
        console.log('Resposta do servidor:', data);
        alert('Sucesso: Todos os dados do usuário foram excluídos com sucesso!');
        const cancelModalInstance = bootstrap.Modal.getInstance(cancelModal);
        if (cancelModalInstance) cancelModalInstance.hide();
        loadUsers(); 
    })
    .catch(error => {
        console.error('Erro ao excluir todos os dados:', error.message, error.stack);
        alert(`Erro ao excluir todos os dados: ${error.message}`);
    });
}
loadChartData();
    loadUsers();
});
    