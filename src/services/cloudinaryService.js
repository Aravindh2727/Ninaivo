/**
 * Cloudinary Profile & Diary Photo Upload Service
 * Supports direct unsigned upload via Cloudinary REST API.
 * Gracefully provides local image preview fallback if Cloudinary credentials are not yet configured.
 */

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB limit

/**
 * Validates file type and size
 */
export function validateImageFile(file) {
  if (!file) {
    throw new Error('Please select an image file.');
  }
  if (!file.type.startsWith('image/')) {
    throw new Error(`"${file.name}" is not a supported image file (JPEG, PNG, WEBP, GIF).`);
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error(`"${file.name}" exceeds the 10MB size limit. Please choose a smaller image.`);
  }
  return true;
}

/**
 * Upload a single profile or entry photo
 */
export async function uploadProfilePhoto(file) {
  validateImageFile(file);

  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME?.trim();
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET?.trim();

  if (cloudName && uploadPreset) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', uploadPreset);
      formData.append('folder', 'project_diary_profiles');

      const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Cloudinary upload failed (HTTP ${response.status})`);
      }

      const data = await response.json();
      return {
        url: data.secure_url,
        provider: 'cloudinary',
        publicId: data.public_id
      };
    } catch (err) {
      console.warn('Cloudinary upload network error, falling back to local file reader:', err);
      return readAsLocalDataUrl(file, 'Cloudinary upload error. Saved locally for preview.');
    }
  }

  return readAsLocalDataUrl(
    file, 
    'Cloudinary credentials not detected in .env. Photo updated via local storage.'
  );
}

/**
 * Upload multiple photos for diary entries with progress tracking
 */
export async function uploadMultipleDiaryPhotos(files, onProgress) {
  if (!files || files.length === 0) return [];

  const results = [];
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME?.trim();
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET?.trim();
  const total = files.length;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    validateImageFile(file);

    if (onProgress) {
      onProgress({ current: i + 1, total, fileName: file.name });
    }

    if (cloudName && uploadPreset) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', uploadPreset);
        formData.append('folder', 'diary_entry_attachments');

        const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
          method: 'POST',
          body: formData
        });

        if (response.ok) {
          const data = await response.json();
          results.push({
            id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            url: data.secure_url,
            publicId: data.public_id,
            name: file.name,
            size: file.size,
            provider: 'cloudinary'
          });
          continue;
        }
      } catch (err) {
        console.warn(`Cloudinary upload failed for ${file.name}, using local fallback:`, err);
      }
    }

    // Local data URL fallback
    const local = await readAsLocalDataUrl(file, 'Saved locally');
    results.push({
      id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      url: local.url,
      publicId: null,
      name: file.name,
      size: file.size,
      provider: 'local'
    });
  }

  return results;
}

function readAsLocalDataUrl(file, notice) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        url: reader.result,
        provider: 'local',
        notice
      });
    };
    reader.onerror = () => {
      reject(new Error(`Failed to read file ${file.name || 'audio'} from disk.`));
    };
    reader.readAsDataURL(file);
  });
}

const MAX_AUDIO_SIZE_BYTES = 25 * 1024 * 1024; // 25MB limit

/**
 * Validates audio file/blob type and size
 */
export function validateAudioBlob(blob) {
  if (!blob) {
    throw new Error('No audio recording provided.');
  }
  if (blob.size === 0) {
    throw new Error('Audio recording is empty. Please record audio before uploading.');
  }
  if (blob.size > MAX_AUDIO_SIZE_BYTES) {
    throw new Error(`Audio recording exceeds the 25MB limit (${(blob.size / (1024 * 1024)).toFixed(1)}MB).`);
  }
  return true;
}

/**
 * Upload voice recording audio blob to Cloudinary unsigned preset
 * Reuses existing cloud name and upload preset; uses /video/upload endpoint for audio files
 */
export async function uploadAudioRecording(audioBlob, metadata = {}, onProgress) {
  validateAudioBlob(audioBlob);

  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME?.trim();
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET?.trim();

  const mimeType = audioBlob.type || 'audio/webm';
  let extension = 'webm';
  if (mimeType.includes('mp4')) extension = 'm4a';
  else if (mimeType.includes('ogg')) extension = 'ogg';
  else if (mimeType.includes('wav')) extension = 'wav';
  else if (mimeType.includes('aac')) extension = 'aac';

  const fileName = metadata.fileName || `voice-note-${Date.now()}.${extension}`;

  if (cloudName && uploadPreset) {
    try {
      if (onProgress) onProgress({ status: 'uploading', progress: 10 });

      const formData = new FormData();
      formData.append('file', audioBlob, fileName);
      formData.append('upload_preset', uploadPreset);
      formData.append('folder', 'diary_entry_voice_notes');
      formData.append('resource_type', 'video'); // Cloudinary processes audio under video resource type

      const result = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`);

        if (xhr.upload && onProgress) {
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const percent = Math.round((e.loaded / e.total) * 100);
              onProgress({ status: 'uploading', progress: percent });
            }
          };
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);
              resolve(data);
            } catch (err) {
              reject(new Error('Invalid response from Cloudinary.'));
            }
          } else {
            try {
              const errData = JSON.parse(xhr.responseText);
              reject(new Error(errData.error?.message || `Upload failed with HTTP ${xhr.status}`));
            } catch {
              reject(new Error(`Upload failed with HTTP ${xhr.status}`));
            }
          }
        };

        xhr.onerror = () => reject(new Error('Network error during audio upload.'));
        xhr.send(formData);
      });

      if (onProgress) onProgress({ status: 'completed', progress: 100 });

      return {
        url: result.secure_url,
        publicId: result.public_id,
        format: result.format || extension,
        mimeType,
        duration: Math.round(result.duration || metadata.duration || 0),
        fileSize: result.bytes || audioBlob.size,
        provider: 'cloudinary'
      };
    } catch (err) {
      console.warn('Cloudinary audio upload failed, falling back to local data URL:', err.message);
      if (onProgress) onProgress({ status: 'local_fallback', error: err.message });
    }
  }

  // Local fallback (offline or credentials unconfigured)
  const local = await readAsLocalDataUrl(audioBlob, 'Saved locally');
  return {
    url: local.url,
    publicId: null,
    format: extension,
    mimeType,
    duration: Math.round(metadata.duration || 0),
    fileSize: audioBlob.size,
    provider: 'local',
    notice: 'Audio saved locally.'
  };
}
