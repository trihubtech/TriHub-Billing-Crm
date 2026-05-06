import { createContext, useContext, useReducer, useEffect, useCallback } from "react";
import api from "../utils/api";

const AuthContext = createContext(null);

function readStoredJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persistSession({ token, user, company, latestPaymentRequest }) {
  if (token) {
    localStorage.setItem("trihub_token", token);
  }
  localStorage.setItem("trihub_user", JSON.stringify(user || null));
  localStorage.setItem("trihub_company", JSON.stringify(company || null));
  localStorage.setItem("trihub_latest_payment_request", JSON.stringify(latestPaymentRequest || null));
}

function clearSession() {
  localStorage.removeItem("trihub_token");
  localStorage.removeItem("trihub_user");
  localStorage.removeItem("trihub_company");
  localStorage.removeItem("trihub_latest_payment_request");
}

const storedToken = localStorage.getItem("trihub_token");
const storedUser = readStoredJson("trihub_user");
const storedCompany = readStoredJson("trihub_company");
const storedLatestPaymentRequest = readStoredJson("trihub_latest_payment_request");

const initialState = {
  user: storedUser,
  company: storedCompany,
  token: storedToken,
  latestPaymentRequest: storedLatestPaymentRequest,
  loading: true,
  isAuthenticated: Boolean(storedToken && storedUser),
};

function authReducer(state, action) {
  switch (action.type) {
    case "AUTH_LOADED":
      return {
        ...state,
        user: action.payload.user,
        company: action.payload.company,
        latestPaymentRequest: action.payload.latestPaymentRequest ?? null,
        isAuthenticated: Boolean(state.token && action.payload.user),
        loading: false,
      };
    case "LOGIN":
      return {
        ...state,
        user: action.payload.user,
        company: action.payload.company,
        token: action.payload.token,
        latestPaymentRequest: action.payload.latestPaymentRequest ?? null,
        isAuthenticated: true,
        loading: false,
      };
    case "UPDATE_PROFILE":
      return {
        ...state,
        user: { ...state.user, ...action.payload },
      };
    case "UPDATE_COMPANY":
      return {
        ...state,
        company: { ...state.company, ...action.payload },
      };
    case "UPDATE_SUBSCRIPTION":
      return {
        ...state,
        user: action.payload.user,
        company: action.payload.company,
        latestPaymentRequest: action.payload.latestPaymentRequest ?? null,
      };
    case "LOGOUT":
      return {
        ...initialState,
        token: null,
        user: null,
        company: null,
        latestPaymentRequest: null,
        isAuthenticated: false,
        loading: false,
      };
    case "LOADING_DONE":
      return { ...state, loading: false };
    default:
      return state;
  }
}

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  useEffect(() => {
    async function loadUser() {
      if (!state.token) {
        dispatch({ type: "LOADING_DONE" });
        return;
      }

      try {
        const [authRes, subscriptionRes] = await Promise.all([
          api.get("/auth/me"),
          api.get("/subscription/status"),
        ]);

        const nextUser = { ...(authRes.data.user || {}), ...(subscriptionRes.data.user || {}) };
        const nextCompany = subscriptionRes.data.company ?? authRes.data.company ?? null;
        const latestPaymentRequest = subscriptionRes.data.latest_payment_request || null;

        persistSession({
          token: state.token,
          user: nextUser,
          company: nextCompany,
          latestPaymentRequest,
        });

        dispatch({
          type: "AUTH_LOADED",
          payload: {
            user: nextUser,
            company: nextCompany,
            latestPaymentRequest,
          },
        });
      } catch (error) {
        const cachedUser = readStoredJson("trihub_user");
        const cachedCompany = readStoredJson("trihub_company");
        const cachedLatestPaymentRequest = readStoredJson("trihub_latest_payment_request");

        if (cachedUser) {
          dispatch({
            type: "AUTH_LOADED",
            payload: {
              user: cachedUser,
              company: cachedCompany,
              latestPaymentRequest: cachedLatestPaymentRequest,
            },
          });
          return;
        }

        clearSession();
        dispatch({ type: "LOGOUT" });
      }
    }

    loadUser();
  }, [state.token]);

  const login = useCallback((token, user, company, latestPaymentRequest = null) => {
    persistSession({ token, user, company, latestPaymentRequest });
    dispatch({ type: "LOGIN", payload: { token, user, company, latestPaymentRequest } });
  }, []);

  const logout = useCallback(() => {
    clearSession();
    dispatch({ type: "LOGOUT" });
  }, []);

  const updateProfile = useCallback((data) => {
    const nextUser = { ...(state.user || {}), ...data };
    persistSession({
      token: state.token,
      user: nextUser,
      company: state.company,
      latestPaymentRequest: state.latestPaymentRequest,
    });
    dispatch({ type: "UPDATE_PROFILE", payload: data });
  }, [state.company, state.latestPaymentRequest, state.token, state.user]);

  const updateCompany = useCallback((data) => {
    const nextCompany = { ...(state.company || {}), ...data };
    persistSession({
      token: state.token,
      user: state.user,
      company: nextCompany,
      latestPaymentRequest: state.latestPaymentRequest,
    });
    dispatch({ type: "UPDATE_COMPANY", payload: data });
  }, [state.company, state.latestPaymentRequest, state.token, state.user]);

  const refreshSubscription = useCallback(async () => {
    if (!state.token) return null;

    const res = await api.get("/subscription/status");
    const nextUser = { ...(state.user || {}), ...(res.data.user || {}) };
    const nextCompany = res.data.company ?? state.company ?? null;
    const latestPaymentRequest = res.data.latest_payment_request || null;

    persistSession({
      token: state.token,
      user: nextUser,
      company: nextCompany,
      latestPaymentRequest,
    });

    dispatch({
      type: "UPDATE_SUBSCRIPTION",
      payload: {
        user: nextUser,
        company: nextCompany,
        latestPaymentRequest,
      },
    });

    return res.data;
  }, [state.company, state.token, state.user]);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        logout,
        refreshSubscription,
        updateProfile,
        updateCompany,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
