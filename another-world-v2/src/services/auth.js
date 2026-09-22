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

export function registerUser({ name, email, password }) {
  const users = getUsers();

  if (users.some((u) => u.email === email)) {
    throw new Error("Já existe uma conta com esse e-mail.");
  }

  const newUser = { name, email, password };
  saveUsers([...users, newUser]);

  // Já cadastra e loga automaticamente.
  const session = { name, email };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function loginUser({ email, password }) {
  const users = getUsers();
  const found = users.find((u) => u.email === email && u.password === password);

  if (!found) {
    throw new Error("E-mail ou senha inválidos.");
  }

  const session = { name: found.name, email: found.email };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function getCurrentUser() {
  const raw = localStorage.getItem(SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function logoutUser() {
  localStorage.removeItem(SESSION_KEY);
}