import React from "react";

const ToggleLoginTabs = ({ loginType, setLoginType }) => (
  <div className="w-full flex justify-center gap-4 mb-4">
    <button
      onClick={() => setLoginType("normal")}
      className={`px-4 py-2 rounded-lg ${
        loginType === "normal"
          ? "bg-blue-600 text-white"
          : "bg-gray-700 text-gray-300"
      }`}
    >
      Email Login
    </button>
    <button
      onClick={() => setLoginType("sso")}
      className={`px-4 py-2 rounded-lg ${
        loginType === "sso"
          ? "bg-blue-600 text-white"
          : "bg-gray-700 text-gray-300"
      }`}
    >
      SSO Login
    </button>
  </div>
);

export default ToggleLoginTabs;
