// ⚠️ SIMULAÇÃO: isso guarda a senha em texto puro no localStorage.
// Nunca faça isso em produção — numa API real, a senha é criptografada
// (hash) no servidor e nunca fica visível nem circula assim.

const USERS_KEY = "aw_users";
const SESSION_KEY = "aw_current_user";

// Pega a lista de usuários "cadastrados" salva no navegador.
function getUsers() {
  const raw = localStorage.getItem(USERS_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

// Monta a sessão a partir do usuário salvo.
// O "...resto" pega TODOS os campos menos a senha — assim, quando alguém
// adicionar um campo novo no cadastro (CPF, cargo...), ele entra na sessão
// sozinho. Escolher campo por campo aqui era o que fazia telefone e empresa
// sumirem toda vez que a pessoa saía e entrava de novo.
function criarSessao(user) {
  const { password, ...resto } = user;
  return resto;
}

export function registerUser({ name, email, password }) {
  const users = getUsers();

  if (users.some((u) => u.email === email)) {
    throw new Error("Já existe uma conta com esse e-mail.");
  }

  const newUser = { name, email, password, telefone: "", empresa: "" };
  saveUsers([...users, newUser]);

  // Já cadastra e loga automaticamente.
  const session = criarSessao(newUser);
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function loginUser({ email, password }) {
  const users = getUsers();
  const found = users.find((u) => u.email === email && u.password === password);

  if (!found) {
    throw new Error("E-mail ou senha inválidos.");
  }

  const session = criarSessao(found);
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

// Atualiza os dados cadastrais de quem está logado.
// Precisa salvar em DOIS lugares: na lista de usuários (pra não perder na
// próxima vez que a pessoa logar) e na sessão atual (pra tela atualizar já).
export function updateUser({ name, telefone, empresa }) {
  const session = getCurrentUser();

  if (!session) {
    throw new Error("Ninguém está logado.");
  }

  const users = getUsers().map((u) =>
    u.email === session.email ? { ...u, name, telefone, empresa } : u
  );
  saveUsers(users);

  const newSession = { ...session, name, telefone, empresa };
  localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
  return newSession;
}

export function getCurrentUser() {
  const raw = localStorage.getItem(SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function logoutUser() {
  localStorage.removeItem(SESSION_KEY);
}