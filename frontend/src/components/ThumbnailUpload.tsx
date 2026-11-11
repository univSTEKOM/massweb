import toast from 'react-hot-toast';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { useState, useRef } from 'react';

interface ThumbnailUploadProps {
    currentUrl?: string;
    onUpload: (file: File) => Promise<void>;
    onRemove?: () => Promise<void>;
}

export function ThumbnailUpload({ currentUrl, onUpload, onRemove }: ThumbnailUploadProps) {
    const [preview, setPreview] = useState<string | null>(currentUrl || null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            toast.error('Please select an image file');
            return;
        }

        // Validate file size (5MB)
        if (file.size > 5 * 1024 * 1024) {
            toast.error('File size must not exceed 5MB');
            return;
        }

        // Show preview
        const reader = new FileReader();
        reader.onloadend = () => {
            setPreview(reader.result as string);
        };
        reader.readAsDataURL(file);

        // Upload
        setIsUploading(true);
        try {
            await onUpload(file);
        } catch (error) {
            setPreview(currentUrl || null);
            toast.error('Failed to upload thumbnail');
        } finally {
            setIsUploading(false);
        }
    };

    const handleRemove = async () => {
        if (!onRemove) return;

        setIsUploading(true);
        try {
            await onRemove();
            setPreview(null);
        } catch (error) {
            toast.error('Failed to remove thumbnail');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="w-full">
            <label className="block text-sm font-medium mb-2">Project Thumbnail</label>

            {preview ? (
                <div className="relative w-full h-48 rounded-lg overflow-hidden border border-gray-200">
                    <img
                        src={preview}
                        alt="Thumbnail preview"
                        className="w-full h-full object-cover"
                    />
                    {onRemove && (
                        <button
                            onClick={handleRemove}
                            disabled={isUploading}
                            className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 disabled:opacity-50"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="w-full h-48 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors disabled:opacity-50"
                >
                    {isUploading ? (
                        <>
                            <Upload className="w-8 h-8 text-gray-400 animate-pulse" />
                            <span className="text-sm text-gray-500">Uploading...</span>
                        </>
                    ) : (
                        <>
                            <ImageIcon className="w-8 h-8 text-gray-400" />
                            <span className="text-sm text-gray-500">Click to upload thumbnail</span>
                            <span className="text-xs text-gray-400">PNG, JPG, GIF, WEBP up to 5MB</span>
                        </>
                    )}
                </button>
            )}

            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
            />
        </div>
    );
}
