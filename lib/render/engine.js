import { readFile } from "node:fs/promises";
import crypto from "node:crypto";

import sharp from "sharp";

import { DEFAULT_RENDER_OUTPUT } from "../constants.js";
import { resolveProductGenPath } from "../paths.js";
import { isCloudinaryConfigured, uploadRenderedImage } from "../cloudinary.js";
import { getDropboxTemporaryLink } from "../dropbox.js";
import { resolveArtworkPlacement } from "./math.js";

function isRemoteUrl(value) {
  return /^https?:\/\//i.test(String(value || ""));
}

function isDataUrl(value) {
  return /^data:/i.test(String(value || ""));
}

async function loadBuffer(source) {
  if (!source) return null;
  if (Buffer.isBuffer(source)) return source;
  if (isDataUrl(source)) {
    return Buffer.from(String(source).split(",")[1] || "", "base64");
  }
  if (isRemoteUrl(source)) {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`image_fetch_${response.status}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }
  return readFile(resolveProductGenPath(String(source).replace(/^\//, "")));
}

function buildLabelArtworkSvg(label) {
  const text = String(label || "ARTWORK").replace(/[<>&"]/g, "");
  return Buffer.from(
    `
      <svg width="1600" height="1600" viewBox="0 0 1600 1600" xmlns="http://www.w3.org/2000/svg">
        <rect width="1600" height="1600" fill="transparent"/>
        <g transform="translate(800 820)">
          <rect x="-520" y="-280" width="1040" height="560" rx="44" fill="rgba(7,8,14,0.08)" stroke="rgba(16,20,30,0.16)" stroke-width="20"/>
          <text x="0" y="-10" text-anchor="middle" fill="#101114" font-size="196" font-family="Arial, Helvetica, sans-serif" font-weight="800">${text}</text>
          <text x="0" y="170" text-anchor="middle" fill="#101114" opacity="0.66" font-size="88" font-family="Arial, Helvetica, sans-serif" letter-spacing="16">GOOD GAME APPAREL</text>
        </g>
      </svg>
    `,
    "utf8"
  );
}

async function buildArtworkBuffer(design) {
  if (design?.artworkMode === "label") {
    return buildLabelArtworkSvg(design?.artworkText || design?.displayName || "ARTWORK");
  }

  if (design?.source === "dropbox" && design?.pathDisplay) {
    const refreshedUrl = await getDropboxTemporaryLink(design.pathDisplay);
    if (refreshedUrl) {
      return loadBuffer(refreshedUrl);
    }
  }

  if (design?.sourceUrl) {
    return loadBuffer(design.sourceUrl);
  }

  return buildLabelArtworkSvg(design?.displayName || "ARTWORK");
}

async function resolveBaseAsset(template, viewId, colourName) {
  const viewAssets = Array.isArray(template?.viewAssets) ? template.viewAssets : [];
  const targetViewId = String(viewId || "front");
  const targetColour = String(colourName || "");
  const normalizedTargetColour = targetColour
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "");
  const viewMatches = viewAssets.filter((asset) => String(asset?.viewId || "front") === targetViewId);
  const colourSpecificViewMatches = viewMatches.filter((asset) => asset?.colourName);
  const exactColourMatch = viewAssets.find(
    (asset) =>
      String(asset?.viewId || "front") === targetViewId &&
      asset?.colourName &&
      String(asset.colourName)
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9]+/g, "") === normalizedTargetColour
  );
  const genericViewMatch = viewAssets.find(
    (asset) => String(asset?.viewId || "front") === targetViewId && !asset?.colourName
  );
  if (exactColourMatch) {
    return loadBuffer(exactColourMatch.assetUrl);
  }
  if (genericViewMatch && !colourSpecificViewMatches.length) {
    return loadBuffer(genericViewMatch.assetUrl);
  }
  if (targetColour && colourSpecificViewMatches.length) {
    throw new Error(`missing_base_asset:${template?.title || template?.id}:${targetColour}:${targetViewId}`);
  }

  const fallbackMatch = viewMatches[0];
  const assetUrl = fallbackMatch?.assetUrl || "/public/mock/placeholder-tee.svg";
  return loadBuffer(assetUrl.startsWith("/mock/") ? `public${assetUrl}` : assetUrl);
}

function toPixelBox(area, output) {
  return {
    x: Math.round(Number(area?.x || 0) * output.width),
    y: Math.round(Number(area?.y || 0) * output.height),
    width: Math.round(Number(area?.width || 0) * output.width),
    height: Math.round(Number(area?.height || 0) * output.height)
  };
}

export async function renderTemplatePreview({ template, design, colourName, viewId = "front" }) {
  const output = DEFAULT_RENDER_OUTPUT;
  const printArea = Array.isArray(template?.printAreas)
    ? template.printAreas.find((entry) => String(entry?.viewId || "front") === String(viewId))
    : null;
  const selectedPrintArea = printArea || template?.printAreas?.[0];
  if (!selectedPrintArea) {
    throw new Error("missing_print_area");
  }

  const [baseBuffer, artworkBuffer] = await Promise.all([
    resolveBaseAsset(template, viewId, colourName),
    buildArtworkBuffer(design)
  ]);

  const base = await sharp(baseBuffer)
    .resize(output.width, output.height, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toBuffer();

  const artMeta = await sharp(artworkBuffer).metadata();
  const box = toPixelBox(selectedPrintArea, output);
  const placement = resolveArtworkPlacement({
    artworkWidth: artMeta.width || 1,
    artworkHeight: artMeta.height || 1,
    printArea: box
  });

  const artworkLayer = await sharp(artworkBuffer)
    .resize(placement.width, placement.height, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 0 }
    })
    .png()
    .toBuffer();

  const renderedBuffer = await sharp(base)
    .composite([
      {
        input: artworkLayer,
        left: placement.left,
        top: placement.top
      }
    ])
    .png()
    .toBuffer();

  const publicId = crypto
    .createHash("sha1")
    .update(`${template?.id}:${design?.id}:${colourName || "default"}:${viewId}`)
    .digest("hex");
  const uploadedUrl = await uploadRenderedImage(renderedBuffer, {
    publicId,
    tags: ["product-gen", String(template?.handle || ""), String(design?.id || "")]
  });

  if (!uploadedUrl && isCloudinaryConfigured()) {
    throw new Error("cloudinary_upload_failed");
  }

  return {
    imageUrl: uploadedUrl || `data:image/png;base64,${renderedBuffer.toString("base64")}`,
    placement: {
      left: placement.left,
      top: placement.top,
      width: placement.width,
      height: placement.height,
      printArea: box
    }
  };
}

export async function renderAllProductImages({ template, design }) {
  const colours = Array.isArray(template?.colours) && template.colours.length ? template.colours : ["Default"];
  const images = [];

  for (const colourName of colours) {
    const result = await renderTemplatePreview({
      template,
      design,
      colourName,
      viewId: "front"
    });
    images.push({
      id: crypto.createHash("sha1").update(`${template?.id}:${design?.id}:${colourName}`).digest("hex"),
      colourName,
      viewId: "front",
      imageUrl: result.imageUrl,
      isPrimary: images.length === 0,
      sortOrder: images.length,
      placement: result.placement
    });
  }

  return images;
}
