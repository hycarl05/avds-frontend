export function getAssetSourceInfo(asset, assetTypeConfig) {
  const assetType = asset.type?.toLowerCase();
  const config = assetTypeConfig[assetType];

  if (config?.displayType === "slideshow") {
    return {
      type: "Slideshow",
      color: "text-purple-400",
      bgColor: "bg-purple-600",
      icon: "📷",
    };
  }

  if (asset.videoPath) {
    return {
      type: "File",
      color: "text-yellow-400",
      bgColor: "bg-yellow-600",
      icon: "📁",
    };
  }

  return {
    type: "Webcam",
    color: "text-green-400",
    bgColor: "bg-green-600",
    icon: "📹",
  };
}
