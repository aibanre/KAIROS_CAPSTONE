import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import * as authApi from "../api/authApi";
import { setUnauthorizedHandler } from "../api/client";
import * as profileApi from "../api/profileApi";

const CustomerAuthContext = createContext(null);

function normalizeUser(user) {
  if (!user) return null;
  const [firstName = "", ...lastNameParts] = (user.full_name || "").split(/\s+/);
  return {
    ...user,
    id: user.user_id,
    firstName: user.first_name || firstName,
    lastName: user.last_name || lastNameParts.join(" "),
    name: user.full_name || `${firstName} ${lastNameParts.join(" ")}`.trim(),
  };
}

export function useCustomerAuth() {
  const value = useContext(CustomerAuthContext);
  if (!value) throw new Error("useCustomerAuth must be used inside CustomerAuthProvider");
  return value;
}

export default function CustomerAuthProvider({ children }) {
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionMessage, setSessionMessage] = useState("");

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      if (window.location.pathname.startsWith("/portal")) {
        window.location.assign("/login");
      }
    });

    authApi.getSession()
      .then((data) => {
        const nextUser = normalizeUser(data.user);
        setUser(nextUser);
        if (nextUser && nextUser.role !== "customer") {
          setSessionMessage("You're signed in with a staff account. Log out first to use the customer portal.");
        }
      })
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));

    return () => setUnauthorizedHandler(null);
  }, [location.pathname]);

  async function login(credentials) {
    const data = await authApi.login(credentials);
    const nextUser = normalizeUser(data.user);
    if (nextUser?.role !== "customer") {
      setUser(nextUser);
      setSessionMessage("You're signed in with a staff account. Log out first to use the customer portal.");
      throw new Error("You're signed in with a staff account. Log out first to use the customer portal.");
    }
    setSessionMessage("");
    setUser(nextUser);
    return nextUser;
  }

  async function register(details) {
    const data = await authApi.register(details);
    return data.user;
  }

  async function logout() {
    await authApi.logout().catch(() => {});
    setUser(null);
    setSessionMessage("");
  }

  async function updateProfile(details) {
    const data = await profileApi.updateProfile(details);
    const nextUser = normalizeUser({ ...user, ...data.user, full_name: data.user?.name || data.user?.full_name || user?.full_name });
    setUser(nextUser);
    return nextUser;
  }

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user && user.role === "customer"),
      isLoading,
      sessionMessage,
      login,
      register,
      logout,
      updateProfile,
    }),
    [user, isLoading, sessionMessage],
  );

  return <CustomerAuthContext.Provider value={value}>{children}</CustomerAuthContext.Provider>;
}
