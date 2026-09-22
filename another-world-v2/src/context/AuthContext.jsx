import { createContext, useContext, useState } from "react";
import { registerUser, loginUser, logoutUser, getCurrentUser } from "../services/auth";

// Context é uma "caixa de informação" que qualquer componente do app
// pode acessar, sem precisar passar props de pai pra filho pra filho
// (imagina passar "user" através de 5 componentes só pra chegar no último —
// o Context evita isso).
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // getCurrentUser() já lê do localStorage — assim, se a pessoa recarregar
  // a página, o estado "user" já nasce preenchido (login não se perde).
  const [user, setUser] = useState(getCurrentUser);

  function register(data) {
    const session = registerUser(data);
    setUser(session);
  }

  function login(data) {
    const session = loginUser(data);
    setUser(session);
  }

  function logout() {
    logoutUser();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, register, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook customizado pra facilitar o uso — em vez de importar useContext +
// AuthContext em todo componente, só importa esse useAuth().
export function useAuth() {
  return useContext(AuthContext);
}