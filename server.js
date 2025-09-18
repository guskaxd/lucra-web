const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
require('dotenv').config();
const cors = require('cors');
const cookieParser = require('cookie-parser');

const app = express();
const port = process.env.PORT || 8080;

const mongoUri = process.env.MONGO_URI;

if (!mongoUri) {
    console.error('Erro: MONGO_URI não está definido no arquivo .env');
    process.exit(1);
}

const client = new MongoClient(mongoUri);

async function connectDB() {
    try {
        await client.connect();
        console.log('Conectado ao MongoDB com sucesso');
        const db = client.db('lucrabet');
        console.log('Banco de dados selecionado:', db.databaseName);
        return db;
    } catch (err) {
        console.error('Erro ao conectar ao MongoDB:', err.message);
        process.exit(1);
    }
}

let db;

async function ensureDBConnection() {
    if (!db) {
        db = await connectDB();
    }
    return db;
}

// Configurar middleware
app.use(cors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    exposedHeaders: ['Set-Cookie']
}));
app.use(express.static(path.join(__dirname, '.')));
app.use(express.json());
app.use(cookieParser());

// Rota para a raiz (/) que serve o login.html como página inicial
app.get('/', (req, res) => {
    console.log('Rota / acessada, servindo login.html');
    res.sendFile(path.join(__dirname, 'login.html'));
});

// Rota para servir index.html apenas para usuários autenticados
app.get('/index.html', (req, res, next) => {
    if (!req.cookies.auth || req.cookies.auth !== 'true') {
        console.log('Usuário não autenticado, redirecionando para login');
        return res.redirect('/');
    }
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Rota de teste para verificar se o servidor está funcionando
app.get('/health', (req, res) => {
    console.log('Rota /health acessada');
    res.json({ status: 'Servidor está rodando' });
});

// =========================================================================
// ROTA PARA ADICIONAR USUÁRIOS (ADICIONADA AQUI)
// =========================================================================
app.post('/api/users', async (req, res) => {
    try {
        const { userId, name, whatsapp, expirationDate } = req.body;

        // Validação dos dados recebidos
        if (!userId || !name || !whatsapp) {
            return res.status(400).json({ message: 'ID do Discord, Nome e WhatsApp são obrigatórios.' });
        }

        db = await ensureDBConnection();
        const registeredUsers = db.collection('registeredUsers');
        const expirationDates = db.collection('expirationDates');

        // Verificar se o usuário já existe
        const existingUser = await registeredUsers.findOne({ userId: userId });
        if (existingUser) {
            return res.status(409).json({ message: 'Um usuário com este ID do Discord já existe.' });
        }

        // Inserir o novo usuário na coleção 'registeredUsers'
        await registeredUsers.insertOne({
            userId: userId,
            name: name,
            whatsapp: whatsapp,
            registeredAt: new Date(),
            paymentHistory: [],
            indication: 'manual'
        });

        // Se uma data de expiração foi fornecida, criar a assinatura
        if (expirationDate) {
            await expirationDates.updateOne(
                { userId: userId },
                { $set: { expirationDate: new Date(expirationDate) } },
                { upsert: true }
            );
        }
        
        console.log(`[API] Novo usuário adicionado manualmente: ${name} (ID: ${userId})`);
        res.status(201).json({ message: 'Usuário adicionado com sucesso!' });

    } catch (error) {
        console.error('[API] Erro ao adicionar usuário manualmente:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

app.get('/users', async (req, res) => {
    try {
        db = await ensureDBConnection();
        const users = await db.collection('registeredUsers').find().toArray();
        
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0); 

        const usersData = await Promise.all(users.map(async (user) => {
            const paymentHistory = user.paymentHistory || [];
            const userIdAsString = String(user.userId);
            const expirationDoc = await db.collection('expirationDates').findOne({ userId: userIdAsString });
            
            // --- INÍCIO DA MUDANÇA ---
            let lastPaymentDate = null;
            let lastPaymentAmount = 0; // Nova variável para o valor

            if (paymentHistory.length > 0) {
                const sortedHistory = [...paymentHistory].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                const lastPayment = sortedHistory[0]; // Pega o objeto de pagamento inteiro
                lastPaymentDate = lastPayment.timestamp;
                lastPaymentAmount = lastPayment.amount; // Armazena o valor
            }
            // --- FIM DA MUDANÇA ---

            let daysRemaining = 0;
            let daysInactive = 0;

            if (expirationDoc && expirationDoc.expirationDate) {
                const expirationDate = new Date(expirationDoc.expirationDate);
                expirationDate.setUTCHours(0, 0, 0, 0);

                if (expirationDate >= today) {
                    const diffTime = expirationDate.getTime() - today.getTime();
                    daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                } else {
                    const diffTime = today.getTime() - expirationDate.getTime();
                    daysInactive = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                }
            } else {
                const registeredDate = new Date(user.registeredAt);
                registeredDate.setUTCHours(0, 0, 0, 0);
                const diffTime = today.getTime() - registeredDate.getTime();
                daysInactive = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            }

            return {
                userId: user.userId,
                name: user.name,
                whatsapp: user.whatsapp,
                registeredAt: user.registeredAt,
                balance: user.balance || 0, 
                discount: user.discount || 0 ,
                expirationDate: expirationDoc ? expirationDoc.expirationDate : null,
                indication: user.indication || null,
                daysRemaining: daysRemaining,
                daysInactive: daysInactive,
                lastPaymentDate: lastPaymentDate,
                lastPaymentAmount: lastPaymentAmount
            };
        }));

        const totalBalanceFromHistory = users.reduce((sum, user) => {
            const paymentHistory = user.paymentHistory || [];
            return sum + paymentHistory.reduce((total, payment) => total + (parseFloat(payment.amount) || 0), 0);
        }, 0);

        res.json({
            users: usersData,
            totalBalanceFromHistory: totalBalanceFromHistory.toFixed(2)
        });
    } catch (err) {
        console.error('Erro na rota /users:', err.message);
        res.status(500).json({ error: 'Erro ao buscar usuários', details: err.message });
    }
});

// Rota para buscar dados de um único usuário
app.get('/user/:userId', async (req, res) => {
    try {
        console.log(`Rota /user/${req.params.userId} acessada`);
        db = await ensureDBConnection();
        const userId = req.params.userId.toString().trim();

        const user = await db.collection('registeredUsers').findOne({ userId }) || {};
        const paymentHistory = user.paymentHistory || [];
        const expirationDoc = await db.collection('expirationDates').findOne({ userId }) || { expirationDate: null };

        res.setHeader('Content-Type', 'application/json');
        res.json({
            userId: user.userId,
            name: user.name,
            whatsapp: user.whatsapp,
            paymentHistory: paymentHistory,
            balance: 0,
            expirationDate: expirationDoc.expirationDate,
            indication: user.indication || null
        });
    } catch (err) {
        console.error('Erro na rota /user/:userId:', err.message);
        res.status(500).json({ error: 'Erro ao buscar dados', details: err.message });
    }
});

// Rota para atualizar dados do usuário
// Em server.js, substitua a sua rota app.put('/user/:userId', ...) por esta versão

app.put('/user/:userId', async (req, res) => {
    try {
        console.log(`Rota PUT /user/${req.params.userId} acessada`);
        db = await ensureDBConnection();
        const userId = String(req.params.userId).trim();
        const { name, balance, expirationDate, indication, discount } = req.body;
        console.log('Dados recebidos:', { name, balance, expirationDate, indication });

        const updates = {};
        if (name !== undefined) updates.name = name;
        if (indication !== undefined) updates.indication = indication || 'Nenhuma';
        
        // --- NOVA LÓGICA PARA ATUALIZAR O SALDO ---
        if (balance !== undefined) {
            const parsedBalance = parseFloat(balance);
            if (!isNaN(parsedBalance)) {
                updates.balance = parsedBalance;
            }
        }
        // --- FIM DA NOVA LÓGICA ---

        // --- NOVA LÓGICA PARA ATUALIZAR O DESCONTO ---
        if (discount !== undefined) {
            const parsedDiscount = parseFloat(discount);
            if (!isNaN(parsedDiscount)) updates.discount = parsedDiscount;
        }
        // --- FIM DA NOVA LÓGICA ---

        if (Object.keys(updates).length > 0) {
            console.log(`Atualizando registeredUsers para ${userId} com:`, updates);
            await db.collection('registeredUsers').updateOne({ userId: userId }, { $set: updates });
        }

        if (expirationDate !== undefined) {
            // ... (o resto da lógica de expiração continua igual)
            if (expirationDate === null || expirationDate === '') {
                await db.collection('expirationDates').deleteOne({ userId: userId });
            } else {
                const parsedExpirationDate = new Date(expirationDate);
                if (isNaN(parsedExpirationDate.getTime())) {
                    return res.status(400).json({ error: 'Data de expiração inválida' });
                }
                await db.collection('expirationDates').updateOne(
                    { userId: userId },
                    { $set: { expirationDate: parsedExpirationDate.toISOString() } },
                    { upsert: true }
                );
            }
        }
        res.json({ message: 'Dados atualizados com sucesso' });
    } catch (err) {
        console.error('Erro na rota PUT /user/:userId:', err.message, err.stack);
        res.status(500).json({ error: 'Erro ao atualizar dados', details: err.message });
    }
});

// Rota para deletar/cancelar assinatura de um usuário
app.delete('/user/:userId', async (req, res) => {
    try {
        console.log(`Rota DELETE /user/${req.params.userId} acessada`);
        db = await ensureDBConnection();
        const userId = req.params.userId.toString().trim();

        if (!userId) {
            console.error('Erro: userId inválido ou vazio');
            return res.status(400).json({ error: 'ID do usuário inválido ou vazio' });
        }

        // Verificar se o usuário existe em registeredUsers
        const userDoc = await db.collection('registeredUsers').findOne({ userId });
        if (!userDoc) {
            console.warn(`Usuário com userId ${userId} não encontrado em registeredUsers`);
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        console.log(`Cancelando assinatura do usuário ${userId}`);

        // Deletar apenas o documento de expirationDates
        const result = await db.collection('expirationDates').deleteOne({ userId });
        console.log('Resultado da exclusão de expirationDates:', { deletedCount: result.deletedCount });

        if (result.deletedCount === 0) {
            console.warn(`Nenhum documento encontrado para userId ${userId} em expirationDates`);
            return res.status(404).json({ message: 'Nenhuma assinatura encontrada para cancelar' });
        }

        res.setHeader('Content-Type', 'application/json');
        res.json({ message: 'Assinatura cancelada com sucesso', deletedCount: result.deletedCount });
    } catch (err) {
        console.error('Erro na rota DELETE /user/:userId:', err.message, err.stack);
        res.status(500).json({ error: 'Erro ao cancelar assinatura', details: err.message });
    }
});

// Rota para deletar todos os dados de um usuário
app.delete('/user/:userId/all', async (req, res) => {
    try {
        console.log(`Rota DELETE /user/${req.params.userId}/all acessada`);
        db = await ensureDBConnection();
        const userId = req.params.userId.toString().trim();

        if (!userId) {
            console.error('Erro: userId inválido ou vazio');
            return res.status(400).json({ error: 'ID do usuário inválido ou vazio' });
        }

        // Verificar se o usuário existe em registeredUsers
        const userDoc = await db.collection('registeredUsers').findOne({ userId });
        if (!userDoc) {
            console.warn(`Usuário com userId ${userId} não encontrado em registeredUsers`);
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        console.log(`Excluindo todos os dados do usuário ${userId}`);

        // Deletar documentos de todas as coleções relevantes
        const expirationResult = await db.collection('expirationDates').deleteOne({ userId });
        const balanceResult = await db.collection('userBalances').deleteOne({ userId });
        const registeredResult = await db.collection('registeredUsers').deleteOne({ userId });
        const couponResult = await db.collection('couponUsage').deleteOne({ userId });

        console.log('Resultado da exclusão de expirationDates:', { deletedCount: expirationResult.deletedCount });
        console.log('Resultado da exclusão de userBalances:', { deletedCount: balanceResult.deletedCount });
        console.log('Resultado da exclusão de registeredUsers:', { deletedCount: registeredResult.deletedCount });
        console.log('Resultado da exclusão de couponUsage:', { deletedCount: couponResult.deletedCount });

        const totalDeleted = expirationResult.deletedCount + balanceResult.deletedCount + registeredResult.deletedCount + couponResult.deletedCount;

        if (totalDeleted === 0) {
            console.warn(`Nenhum dado excluído para userId ${userId}`);
            return res.status(404).json({ message: 'Nenhum dado encontrado para excluir' });
        }

        res.setHeader('Content-Type', 'application/json');
        res.json({ message: 'Todos os dados do usuário foram excluídos com sucesso', totalDeleted });
    } catch (err) {
        console.error('Erro na rota DELETE /user/:userId/all:', err.message, err.stack);
        res.status(500).json({ error: 'Erro ao excluir todos os dados', details: err.message });
    }
});

// Rota para login
app.post('/login', (req, res) => {
    console.log('Rota /login acessada');
    const { username, password } = req.body;

    if (username === 'admin' && password === '123') {
        res.cookie('auth', 'true', { maxAge: 3600000, httpOnly: true });
        console.log('Login bem-sucedido, cookie definido');
        res.json({ success: true, message: 'Login bem-sucedido' });
    } else {
        console.log('Credenciais inválidas');
        res.status(401).json({ success: false, message: 'Credenciais inválidas' });
    }
});

// Rota para verificar autenticação
app.get('/check-auth', (req, res) => {
    console.log('Rota /check-auth acessada');
    const isAuthenticated = req.cookies.auth === 'true';
    res.json({ isAuthenticated });
});

// Rota para logout
app.post('/logout', (req, res) => {
    console.log('Rota /logout acessada');
    res.clearCookie('auth');
    res.json({ success: true, message: 'Logout bem-sucedido' });
});

app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});