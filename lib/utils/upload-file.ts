import { getApiUrl } from '@/lib/api-config';
import { supabase } from '@/lib/utils/supabase';

/**
 * Robust file upload utility.
 * 1. Uploads directly to Express backend (/api/upload).
 * 2. Provides real-time progress feedback (0 - 100%).
 * 3. Supports AbortSignal for user cancellation.
 * 4. Falls back to Supabase Storage if backend is unavailable.
 */
export async function uploadFile(
  file: File,
  onProgress?: (percent: number) => void,
  abortSignal?: AbortSignal
): Promise<string> {
  const apiUrl = getApiUrl();
  const uploadUrl = `${apiUrl}/api/upload`;

  // Stored auth token
  const token = typeof window !== 'undefined' ? localStorage.getItem('attendance_token') : null;
  const schoolId = typeof window !== 'undefined' ? localStorage.getItem('x-school-id') : null;

  try {
    const url = await new Promise<string>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append('file', file);

      xhr.open('POST', uploadUrl, true);
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }
      if (schoolId) {
        xhr.setRequestHeader('x-school-id', schoolId);
      }

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = (event.loaded / event.total) * 100;
            onProgress(percent);
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            if (response.url) {
              resolve(response.url);
            } else {
              reject(new Error(response.message || 'No URL returned from upload server'));
            }
          } catch (e: any) {
            reject(new Error('Invalid response from upload server'));
          }
        } else {
          reject(new Error(`Server upload failed with status ${xhr.status}: ${xhr.responseText}`));
        }
      };

      xhr.onerror = () => reject(new Error('Upload network error'));
      xhr.onabort = () => reject(new Error('Upload aborted'));

      if (abortSignal) {
        if (abortSignal.aborted) {
          xhr.abort();
          return;
        }
        abortSignal.addEventListener('abort', () => xhr.abort());
      }

      xhr.send(formData);
    });

    return url;
  } catch (backendError: any) {
    if (backendError.message === 'Upload aborted') {
      throw backendError;
    }

    console.warn('[uploadFile] Backend upload failed, checking fallback...', backendError);

    // Fallback: Supabase Storage
    try {
      const fileExt = file.name.split('.').pop() || 'dat';
      const fileName = `${Math.random().toString(36).substring(2, 9)}-${Date.now()}.${fileExt}`;
      const filePath = `chat-attachments/${fileName}`;

      const { error } = await supabase.storage.from('communication-attachments').upload(filePath, file);
      if (error) throw error;

      const { data, error: signError } = await supabase.storage
        .from('communication-attachments')
        .createSignedUrl(filePath, 315360000);

      if (signError || !data?.signedUrl) {
        const { data: { publicUrl } } = supabase.storage
          .from('communication-attachments')
          .getPublicUrl(filePath);
        return publicUrl;
      }
      return data.signedUrl;
    } catch (supabaseError: any) {
      console.error('[uploadFile] Both backend and Supabase upload failed:', { backendError, supabaseError });
      throw new Error(backendError.message || 'Failed to upload file');
    }
  }
}

