// utils/statusConfig.js
import { Circle, CircleDot, AlertTriangle } from "lucide-react";

export const getStatusConfig = (status, assetId, activeStreams) => {
  if (activeStreams.has(assetId)) {
    return {
      icon: CircleDot,
      label: "Streaming",
      color: "text-green-400",
      bgColor: "bg-green-900/50",
      pulseColor: "bg-green-400",
    };
  }

  const normalizedStatus = status?.toLowerCase();
  switch (normalizedStatus) {
    case "online":
    case "1":
      return {
        icon: Circle,
        label: "Online",
        color: "text-green-400",
        bgColor: "bg-green-900/50",
        pulseColor: "bg-green-400",
      };
    case "warning":
      return {
        icon: AlertTriangle,
        label: "Warning",
        color: "text-yellow-400",
        bgColor: "bg-yellow-900/50",
        pulseColor: "bg-yellow-400",
      };
    case "offline":
    case "2":
    default:
      return {
        icon: Circle,
        label: "Offline",
        color: "text-red-400",
        bgColor: "bg-red-900/50",
        pulseColor: "bg-red-400",
      };
  }
};
