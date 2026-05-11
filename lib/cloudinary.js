import { v2 as cloudinary } from "cloudinary";

function configured() {
  return Boolean(String(process.env.CLOUDINARY_URL || "").trim());
}

export async function uploadRenderedImage(buffer, options = {}) {
  if (!configured() || !buffer) return null;

  cloudinary.config({
    secure: true
  });

  const folder = String(process.env.CLOUDINARY_UPLOAD_FOLDER || "ImageGen").trim();

  return new Promise((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        public_id: options.publicId,
        overwrite: true,
        tags: Array.isArray(options.tags) ? options.tags : undefined
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(result?.secure_url || null);
      }
    );

    upload.end(buffer);
  });
}
