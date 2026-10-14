import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import * as authApi from "../api/authApi";
import { setUnauthorizedHandler } from "../api/client";
import * as profileApi from "../api/profileApi";

const CustomerAuthContext = createContext(null);
const SESSION_EXPIRED_MESSAGE = "Your session expired. Please log in again.";
const RETURN_PATH_KEY = "customer_auth_return_path";

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
        sessionStorage.setItem(RETURN_PATH_KEY, `${window.location.pathname}${window.location.search}${window.location.hash}`);
        sessionStorage.setItem("customer_auth_message", SESSION_EXPIRED_MESSAGE);
        window.location.assign("/login");
      }
    });

    const storedMessage = sessionStorage.getItem("customer_auth_message");
    if (storedMessage) {
      setSessionMessage(storedMessage);
      sessionStorage.removeItem("customer_auth_message");
    }

    authApi.getSession()
      .then((data) => {
        const nextUser = normalizeUser(data.user);
        setUser(nextUser?.role === "customer" ? nextUser : null);
      })
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));

    return () => setUnauthorizedHandler(null);
  }, [location.pathname]);

  async function login(credentials) {
    const data = await authApi.login(credentials);
    if (data.verification_required) return data;
    const nextUser = normalizeUser(data.user);
    setUser(nextUser?.role === "customer" ? nextUser : null);
    const returnPath = sessionStorage.getItem(RETURN_PATH_KEY);
    if (returnPath) {
      sessionStorage.removeItem(RETURN_PATH_KEY);
      window.location.assign(returnPath);
    }
    return nextUser;
  }

  async function register(details) {
    return authApi.register(details);
  }

  async function verifyRegistration(email, code) {
    return authApi.verifyRegistration(email, code);
  }

  async function resendRegistrationCode(email) {
    return authApi.resendRegistrationCode(email);
  }

  async function verifyLogin(challenge, code) {
    const data = await authApi.verifyLogin(challenge, code);
    const nextUser = normalizeUser(data.user);
    setUser(nextUser?.role === "customer" ? nextUser : null);
    const returnPath = sessionStorage.getItem(RETURN_PATH_KEY);
    if (returnPath) {
      sessionStorage.removeItem(RETURN_PATH_KEY);
      window.location.assign(returnPath);
    }
    return nextUser;
  }

  async function resendLoginCode(challenge) {
    return authApi.resendLoginCode(challenge);
  }

  async function forgotPassword(email) {
    return authApi.forgotPassword(email);
  }

  async function resetPassword(details) {
    return authApi.resetPassword(details);
  }

  async function googleSignIn(credential) {
    const data = await authApi.googleSignIn(credential);
    if (data.needs_birthday) return data;
    const nextUser = normalizeUser(data.user);
    setUser(nextUser?.role === "customer" ? nextUser : null);
    return nextUser;
  }

  async function completeGoogleSignIn(details) {
    const data = await authApi.completeGoogleSignIn(details);
    const nextUser = normalizeUser(data.user);
    setUser(nextUser?.role === "customer" ? nextUser : null);
    return nextUser;
  }

  async function logout() {
    await authApi.logout().catch(() => {});
    setUser(null);
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
      verifyRegistration,
      resendRegistrationCode,
      verifyLogin,
      resendLoginCode,
      forgotPassword,
      resetPassword,
      googleSignIn,
      completeGoogleSignIn,
      logout,
      updateProfile,
    }),
    [user, isLoading, sessionMessage],
  );

  return <CustomerAuthContext.Provider value={value}>{children}</CustomerAuthContext.Provider>;
}
