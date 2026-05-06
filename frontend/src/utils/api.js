

import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  timeout: 30000,
});


api.interceptors.request.use((config) => {
  const token = localStorage.getItem("trihub_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});


api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("trihub_token");
      localStorage.removeItem("trihub_user");
      localStorage.removeItem("trihub_company");
      localStorage.removeItem("trihub_latest_payment_request");
      if (window.location.pathname !== "/") {
        window.location.href = "/";
      }
    }
    if (err.response?.data?.error === "SUBSCRIPTION_EXPIRED") {
      window.location.href = "/subscribe";
    }
    return Promise.reject(err);
  }
);

export default api;
