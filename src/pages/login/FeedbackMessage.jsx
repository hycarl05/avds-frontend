import React from "react";

const FeedbackMessage = ({ type, message }) => {
  if (!message) return null;

  const color = type === "error" ? "red" : "green";

  return (
    <div
      className={`w-full p-3 bg-${color}-500/20 border border-${color}-500/50 text-${color}-200 text-sm rounded-lg`}
    >
      {message}
    </div>
  );
};

export default FeedbackMessage;
