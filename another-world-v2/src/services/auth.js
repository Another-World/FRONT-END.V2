// ⚠️ SIMULAÇÃO PARA DESENVOLVIMENTO
// Este arquivo usa localStorage e salva senhas em texto puro.
// Não utilize este sistema de autenticação em produção.
// Em um sistema real, a autenticação e as permissões devem ser
// verificadas no servidor.

const USERS_KEY = "aw_users";
const SESSION_KEY = "aw_current_user";

// Recupera a lista de usuários cadastrados.
function getUsers() {
  const raw = localStorage.getItem(USERS_KEY);
  return raw ? JSON.parse(raw) : [];
}

// Salva a lista de usuários.
function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

// Cria uma sessão sem expor a senha.
function criarSessao(user) {
  const { password, ...resto } = user;
  return resto;
}

// Cadastra um novo usuário.
export function registerUser({ name, email, password }) {
  const users = getUsers();

  const emailNormalizado = email.trim().toLowerCase();

  if (
    users.some(
      (u) => u.email.trim().toLowerCase() === emailNormalizado
    )
  ) {
    throw new Error("Já existe uma conta com esse e-mail.");
  }

  const newUser = {
    name,
    email: emailNormalizado,
    password,
    telefone: "",
    empresa: "",
    role: "cliente",
  };

  saveUsers([...users, newUser]);

  const session = criarSessao(newUser);

  localStorage.setItem(SESSION_KEY, JSON.stringify(session));

  return session;
}

// Realiza o login.
export function loginUser({ email, password }) {
  const users = getUsers();

  const emailNormalizado = email.trim().toLowerCase();

  const found = users.find(
    (u) =>
      u.email.trim().toLowerCase() === emailNormalizado &&
      u.password === password
  );

  if (!found) {
    throw new Error("E-mail ou senha inválidos.");
  }

  // Usuários antigos sem role são considerados clientes.
  const usuarioAtualizado = {
    ...found,
    role: found.role || "cliente",
  };

  // Atualiza o cadastro caso seja um usuário antigo.
  saveUsers(
    users.map((u) =>
      u.email === found.email ? usuarioAtualizado : u
    )
  );

  const session = criarSessao(usuarioAtualizado);

  localStorage.setItem(SESSION_KEY, JSON.stringify(session));

  return session;
}

// Atualiza os dados do usuário conectado.
export function updateUser({ name, telefone, empresa }) {
  const session = getCurrentUser();

  if (!session) {
    throw new Error("Ninguém está logado.");
  }

  const users = getUsers();

  const usuarioEncontrado = users.find(
    (u) => u.email === session.email
  );

  if (!usuarioEncontrado) {
    throw new Error("Usuário não encontrado.");
  }

  const usuarioAtualizado = {
    ...usuarioEncontrado,
    name,
    telefone,
    empresa,
  };

  saveUsers(
    users.map((u) =>
      u.email === session.email ? usuarioAtualizado : u
    )
  );

  // Mantém os demais dados da sessão, inclusive o perfil.
  const newSession = criarSessao(usuarioAtualizado);

  localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));

  return newSession;
}

// Recupera a sessão atual.
export function getCurrentUser() {
  const raw = localStorage.getItem(SESSION_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

// Encerra a sessão.
export function logoutUser() {
  localStorage.removeItem(SESSION_KEY);
}