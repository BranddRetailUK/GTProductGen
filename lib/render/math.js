export function resolveArtworkPlacement({
  artworkWidth,
  artworkHeight,
  printArea
}) {
  const boxWidth = Number(printArea?.width || 0);
  const boxHeight = Number(printArea?.height || 0);
  const originX = Number(printArea?.x || 0);
  const originY = Number(printArea?.y || 0);

  if (!artworkWidth || !artworkHeight || !boxWidth || !boxHeight) {
    return {
      left: originX,
      top: originY,
      width: boxWidth,
      height: boxHeight,
      scale: 1
    };
  }

  const scale = Math.min(boxWidth / artworkWidth, boxHeight / artworkHeight);
  const width = Math.round(artworkWidth * scale);
  const height = Math.round(artworkHeight * scale);
  const left = Math.round(originX + (boxWidth - width) / 2);
  const top = Math.round(originY);

  return {
    left,
    top,
    width,
    height,
    scale
  };
}
