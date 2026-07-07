import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import config from "../../config";
import LoginForm from "./LoginForm";
import SSOButton from "./SSOButton";
import ToggleLoginTabs from "./ToggleLoginTabs";
import FeedbackMessage from "./FeedbackMessage";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginType, setLoginType] = useState("normal");

  // Use the short /sso entry point — safe to share/email, starts a fresh login flow
  const MICROSOFT_AUTH_URL = config.API_URL + "/sso";

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const from = location.state?.from?.pathname || "/peta";
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  useEffect(() => {
    // Handle success message from navigation state
    if (location.state?.message) {
      setSuccess(location.state.message);
      window.history.replaceState({}, document.title);
    }

    // Handle error message from navigation state (e.g., from OAuth callback)
    if (location.state?.error) {
      setError(location.state.error);
      window.history.replaceState({}, document.title);
    }

    // Handle query parameters (legacy support)
    const params = new URLSearchParams(location.search);
    const token = params.get("token");
    const errorParam = params.get("error");

    if (token) {
      console.log("Token received in URL, saving and redirecting...");
      localStorage.setItem("authToken", token);
      setSuccess("SSO login successful!");
      setTimeout(() => {
        const from = location.state?.from?.pathname || "/peta";
        navigate(from, { replace: true });
      }, 500);
    } else if (errorParam) {
      setError("SSO login failed. Please try again.");
    }
  }, [location, navigate]);

  const handleNormalLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!email || !password) {
      setError("Please enter both email and password");
      setLoading(false);
      return;
    }

    try {
      const result = await login({ email, password });

      if (result.success) {
        setSuccess("Login successful!");
        // Small delay to ensure state is updated
        setTimeout(() => {
          const from = location.state?.from?.pathname || "/peta";
          navigate(from, { replace: true });
        }, 100);
      } else {
        setError(result.message || "Login failed");
      }
    } catch (err) {
      console.error('Login exception:', err);
      setError("An error occurred during login");
    } finally {
      setLoading(false);
    }
  };

  const handleMicrosoftSignIn = () => {
    setLoading(true);
    window.location.href = MICROSOFT_AUTH_URL;
  };

  return (
    <div className="w-full h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-slate-800 p-4">
      {/* Background Blur Effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-blue-900 rounded-full mix-blend-multiply filter blur-3xl opacity-30"></div>
        <div className="absolute top-40 -right-40 w-80 h-80 bg-indigo-900 rounded-full mix-blend-multiply filter blur-3xl opacity-30"></div>
        <div className="absolute bottom-40 left-20 w-80 h-80 bg-teal-900 rounded-full mix-blend-multiply filter blur-3xl opacity-30"></div>
      </div>

      {/* Login Container */}
      <div className="w-full max-w-md p-8 backdrop-blur-sm bg-white/10 flex flex-col items-center gap-6 rounded-2xl shadow-2xl border border-white/20 relative z-10">
        <h1 className="text-3xl font-bold text-white mb-2">CCS PLUS</h1>

        <ToggleLoginTabs loginType={loginType} setLoginType={setLoginType} />

        <FeedbackMessage type="error" message={error} />
        <FeedbackMessage type="success" message={success} />

        {loginType === "normal" ? (
          <LoginForm
            email={email}
            password={password}
            setEmail={setEmail}
            setPassword={setPassword}
            handleSubmit={handleNormalLogin}
            loading={loading}
          />
        ) : (
          <SSOButton handleClick={handleMicrosoftSignIn} loading={loading} />
        )}
      </div>
    </div>
  );
};

export default Login;
