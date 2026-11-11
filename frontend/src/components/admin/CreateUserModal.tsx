import { useState } from 'react'
import { Loader2, UserPlus } from 'lucide-react'
import { Modal } from '../Modal'
import { PasswordField } from '../AuthShell'

interface CreateUserModalProps {
    isOpen: boolean
    onClose: () => void
    onSave: (data: { email: string; password: string; name: string; isSuperAdmin: boolean }) => Promise<void>
}

const EMPTY = { email: '', password: '', name: '', isSuperAdmin: false }

export function CreateUserModal({ isOpen, onClose, onSave }: CreateUserModalProps) {
    const [formData, setFormData] = useState(EMPTY)
    const [isLoading, setIsLoading] = useState(false)

    const valid = formData.name.trim() && formData.email.trim() && formData.password.length >= 8

    const close = () => {
        setFormData(EMPTY)
        onClose()
    }

    const handleSubmit = async () => {
        if (!valid) return
        setIsLoading(true)
        try {
            await onSave({ ...formData, name: formData.name.trim(), email: formData.email.trim() })
            close()
        } catch {
            // the caller shows the error; keep the form open
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Modal
            open={isOpen}
            onClose={close}
            title="Add user"
            description="Create an account. Add the user to organizations afterwards."
            footer={
                <>
                    <button className="btn btn-secondary" onClick={close}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSubmit} disabled={!valid || isLoading}>
                        {isLoading ? <Loader2 className="animate-spin" /> : <UserPlus />}
                        Create user
                    </button>
                </>
            }
        >
            <form
                className="space-y-4"
                onSubmit={(e) => {
                    e.preventDefault()
                    handleSubmit()
                }}
            >
                <div>
                    <label className="label" htmlFor="cu-name">Full name</label>
                    <input id="cu-name" className="field" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} autoFocus />
                </div>
                <div>
                    <label className="label" htmlFor="cu-email">Email</label>
                    <input id="cu-email" type="email" className="field" placeholder="user@example.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                </div>
                <div>
                    <label className="label" htmlFor="cu-password">Password</label>
                    <PasswordField id="cu-password" autoComplete="new-password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
                    <p className={`hint ${formData.password && formData.password.length < 8 ? 'text-red-600' : ''}`}>At least 8 characters.</p>
                </div>
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3">
                    <input type="checkbox" className="checkbox mt-0.5" checked={formData.isSuperAdmin} onChange={(e) => setFormData({ ...formData, isSuperAdmin: e.target.checked })} />
                    <span>
                        <span className="block text-sm font-medium text-gray-900">Super admin</span>
                        <span className="block text-xs text-gray-500">Full access to every organization, user and job.</span>
                    </span>
                </label>
            </form>
        </Modal>
    )
}
