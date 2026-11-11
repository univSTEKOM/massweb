import { useState } from 'react';
import { AlertTriangle, Check, Copy, Key, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from './Modal';

interface CreateApiKeyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreated: () => void;
    organizationId: string;
}

/** Shows a newly generated secret once, with a copy button and a clear warning. */
export function KeyReveal({ value, warning }: { value: string; warning: string }) {
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        toast.success('API key copied');
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <div className="space-y-4">
            <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                    <strong className="font-semibold">Copy this key now.</strong> {warning}
                </p>
            </div>
            <div>
                <span className="label">API key</span>
                <div className="flex gap-2">
                    <input value={value} readOnly className="field font-mono text-xs" onFocus={(e) => e.target.select()} aria-label="API key" />
                    <button className="btn btn-secondary btn-icon h-10 w-10" onClick={copy} title="Copy" aria-label="Copy API key">
                        {copied ? <Check className="text-emerald-600" /> : <Copy />}
                    </button>
                </div>
            </div>
        </div>
    );
}

export function CreateApiKeyModal({ isOpen, onClose, onCreated, organizationId }: CreateApiKeyModalProps) {
    const [name, setName] = useState('');
    const [expiryDays, setExpiryDays] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [generatedKey, setGeneratedKey] = useState<string | null>(null);

    const handleCreate = async () => {
        if (!name.trim()) return;
        setIsLoading(true);
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/api/api-keys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                credentials: 'include',
                body: JSON.stringify({ name: name.trim(), organizationId, expiryDays: expiryDays || undefined }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                const message = errorData?.message || 'Failed to create API key';
                const byStatus: Record<number, string> = {
                    401: 'Your session expired. Please sign in again.',
                    403: 'You do not have permission to create API keys for this organization.',
                    404: 'Organization not found.',
                };
                toast.error(byStatus[response.status] || (Array.isArray(message) ? message.join(', ') : message));
                return;
            }

            const data = await response.json();
            setGeneratedKey(data.plainKey);
            toast.success('API key created');
            onCreated();
        } catch (error) {
            toast.error('Network error. Please check your connection and try again.');
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        setName('');
        setExpiryDays(null);
        setGeneratedKey(null);
        onClose();
    };

    return (
        <Modal
            open={isOpen}
            onClose={handleClose}
            dismissible={!generatedKey}
            title={generatedKey ? 'API key created' : 'Create API key'}
            description={generatedKey ? undefined : 'Use it in the X-API-Key header to read content through the public API.'}
            footer={
                generatedKey ? (
                    <button className="btn btn-primary" onClick={handleClose}>
                        I&apos;ve saved it
                    </button>
                ) : (
                    <>
                        <button className="btn btn-secondary" onClick={handleClose}>
                            Cancel
                        </button>
                        <button className="btn btn-primary" onClick={handleCreate} disabled={!name.trim() || isLoading}>
                            {isLoading ? <Loader2 className="animate-spin" /> : <Key />}
                            Generate key
                        </button>
                    </>
                )
            }
        >
            {generatedKey ? (
                <KeyReveal value={generatedKey} warning="For security it will not be shown again." />
            ) : (
                <form
                    className="space-y-5"
                    onSubmit={(e) => {
                        e.preventDefault();
                        handleCreate();
                    }}
                >
                    <div>
                        <label className="label" htmlFor="key-name">Name</label>
                        <input
                            id="key-name"
                            className="field"
                            placeholder="e.g. Production website"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            autoFocus
                        />
                        <p className="hint">A descriptive name so you know where this key is used.</p>
                    </div>
                    <div>
                        <label className="label" htmlFor="key-expiry">Expiration</label>
                        <select
                            id="key-expiry"
                            className="field"
                            value={expiryDays || ''}
                            onChange={(e) => setExpiryDays(e.target.value ? Number(e.target.value) : null)}
                        >
                            <option value="">Never</option>
                            <option value="30">30 days</option>
                            <option value="60">60 days</option>
                            <option value="90">90 days</option>
                            <option value="365">1 year</option>
                        </select>
                    </div>
                </form>
            )}
        </Modal>
    );
}
