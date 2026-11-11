import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Modal } from '../Modal'

interface EditUserModalProps {
    isOpen: boolean
    onClose: () => void
    user: { id: string; name?: string; email?: string } | null
    onSave: (data: { name?: string; email?: string }) => Promise<void>
}

export function EditUserModal({ isOpen, onClose, user, onSave }: EditUserModalProps) {
    const [formData, setFormData] = useState({ name: '', email: '' })
    const [isLoading, setIsLoading] = useState(false)

    // Load the selected user's values every time the modal opens
    useEffect(() => {
        if (isOpen && user) setFormData({ name: user.name || '', email: user.email || '' })
    }, [isOpen, user])

    const valid = formData.name.trim() && formData.email.trim()

    const handleSubmit = async () => {
        if (!valid) return
        setIsLoading(true)
        try {
            await onSave({ name: formData.name.trim(), email: formData.email.trim() })
            onClose()
        } catch {
            // the caller shows the error; keep the form open
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            title="Edit user"
            footer={
                <>
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSubmit} disabled={!valid || isLoading}>
                        {isLoading && <Loader2 className="animate-spin" />}
                        Save changes
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
                    <label className="label" htmlFor="eu-name">Full name</label>
                    <input id="eu-name" className="field" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} autoFocus />
                </div>
                <div>
                    <label className="label" htmlFor="eu-email">Email</label>
                    <input id="eu-email" type="email" className="field" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                </div>
            </form>
        </Modal>
    )
}
