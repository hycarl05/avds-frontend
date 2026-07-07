import React from "react";

const LoginForm = ({
  email,
  password,
  setEmail,
  setPassword,
  handleSubmit,
  loading,
}) => (
  <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
    <input
      type="email"
      placeholder="Email"
      value={email}
      onChange={(e) => setEmail(e.target.value)}
      className="w-full p-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
      disabled={loading}
    />
    <input
      type="password"
      placeholder="Password"
      value={password}
      onChange={(e) => setPassword(e.target.value)}
      className="w-full p-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
      disabled={loading}
    />
    <button
      type="submit"
      className={`w-full p-4 bg-gradient-to-r from-blue-600 to-blue-500 rounded-xl hover:from-blue-500 hover:to-blue-400 text-white font-medium shadow-lg shadow-blue-500/20 transition-all hover:shadow-blue-400/30 hover:scale-[1.01] active:scale-[0.98] ${
        loading ? "opacity-70 cursor-not-allowed" : ""
      }`}
      disabled={loading}
    >
      {loading ? "Processing..." : "Sign in"}
    </button>
  </form>
);

export default LoginForm;
