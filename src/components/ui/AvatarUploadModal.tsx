import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { Avatar } from './Avatar';

interface AvatarUploadModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (file: File) => Promise<void>;
  currentAvatarUrl?: string | null;
  currentName?: string | null;
  uploading?: boolean;
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/gif'];
const MAX_BYTES = 2 * 1024 * 1024;

export function AvatarUploadModal({
  open,
  onClose,
  onSave,
  currentAvatarUrl,
  currentName,
  uploading = false,
}: AvatarUploadModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Reset internal state when the modal opens/closes
  useEffect(() => {
    if (!open) {
      setFile(null);
      setError(null);
      setIsDragging(false);
    }
  }, [open]);

  // Manage the object URL for the local preview
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Focus trap + Escape key
  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !uploading) {
        onClose();
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [tabindex]:not([tabindex="-1"]), input:not([disabled])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, uploading, onClose]);

  function validateAndSet(candidate: File | undefined | null) {
    if (!candidate) return;
    if (!candidate.type.startsWith('image/') || !ACCEPTED_TYPES.includes(candidate.type)) {
      setError('Only JPG, PNG, or GIF files are supported.');
      setFile(null);
      return;
    }
    if (candidate.size > MAX_BYTES) {
      setError('File is larger than 2MB. Please choose a smaller image.');
      setFile(null);
      return;
    }
    setError(null);
    setFile(candidate);
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    validateAndSet(e.target.files?.[0]);
    if (e.target) e.target.value = '';
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    validateAndSet(e.dataTransfer.files?.[0]);
  }

  async function handleSave() {
    if (!file) return;
    await onSave(file);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,.5)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !uploading) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="avatar-upload-title"
        tabIndex={-1}
        className="outline-none"
        style={{
          maxWidth: 380,
          width: '100%',
          backgroundColor: '#fff',
          border: '1.5px solid #002339',
          borderRadius: 16,
          boxShadow: '0 20px 40px -8px rgba(0,35,57,.22)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ padding: '20px 22px 8px' }}>
          <h2
            id="avatar-upload-title"
            className="font-heading"
            style={{ fontSize: 16, color: '#002339', margin: 0, fontWeight: 700 }}
          >
            Update photo
          </h2>
          <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>
            JPG, PNG, or GIF · 2MB max
          </p>
        </div>

        {/* Body */}
        <div style={{ padding: '12px 22px 18px' }}>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              if (!uploading) setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            style={{
              background: '#F4F8FB',
              border: isDragging
                ? '1.5px dashed #005D97'
                : '1.5px dashed #00233930',
              borderRadius: 12,
              padding: 20,
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              transition: 'border-color 150ms ease',
            }}
          >
            {/* Live preview — 88px circular */}
            <div style={{ width: 88, height: 88 }}>
              <Avatar
                src={previewUrl ?? currentAvatarUrl}
                name={currentName}
                size="xl"
                className="!w-[88px] !h-[88px]"
              />
            </div>

            <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>
              Drop an image or
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#005D97',
                backgroundColor: '#fff',
                border: '1px solid #005D9730',
                borderRadius: 6,
                padding: '6px 12px',
                cursor: uploading ? 'not-allowed' : 'pointer',
              }}
            >
              Browse files
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </div>

          {error && (
            <p
              role="alert"
              style={{
                fontSize: 12,
                color: '#BA2C2C',
                margin: '10px 0 0',
              }}
            >
              {error}
            </p>
          )}
        </div>

        {/* Action bar */}
        <div
          className="flex justify-end"
          style={{
            backgroundColor: '#F7F9FC',
            borderTop: '1px solid #00233918',
            padding: '14px 22px',
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            style={{
              backgroundColor: '#fff',
              border: '1px solid #cbd5e1',
              color: '#475569',
              fontSize: 13,
              fontWeight: 600,
              padding: '8px 16px',
              borderRadius: 8,
              cursor: uploading ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!file || uploading}
            style={{
              backgroundColor: '#005D97',
              border: 'none',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              padding: '8px 16px',
              borderRadius: 8,
              cursor: !file || uploading ? 'not-allowed' : 'pointer',
              opacity: !file || uploading ? 0.6 : 1,
            }}
          >
            {uploading ? 'Uploading…' : 'Save photo'}
          </button>
        </div>
      </div>
    </div>
  );
}
