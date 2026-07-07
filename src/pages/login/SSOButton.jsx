import React from "react";
import { FaMicrosoft } from "react-icons/fa";

const SSOButton = ({ handleClick, loading }) => (
  <button
    onClick={handleClick}
    className={`w-full p-4 bg-gradient-to-r from-blue-600 to-blue-500 rounded-xl hover:from-blue-500 hover:to-blue-400 text-white font-medium shadow-lg shadow-blue-500/20 transition-all hover:shadow-blue-400/30 hover:scale-[1.01] active:scale-[0.98] flex items-center justify-center gap-3 ${
      loading ? "opacity-70 cursor-not-allowed" : ""
    }`}
    disabled={loading}
  >
    <FaMicrosoft className="text-xl" />
    {loading ? "Processing..." : "Sign in with Microsoft"}
  </button>
);

export default SSOButton;
