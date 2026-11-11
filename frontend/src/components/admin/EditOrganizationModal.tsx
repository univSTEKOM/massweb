import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Modal } from '../Modal'

interface EditOrganizationModalProps {
    isOpen: boolean
    onClose: () => void
    organization: { id: string; name?: string } | null
    onSave: (data: { name: string }) => Promise<void>
}

export function EditOrganizationModal({ isOpen, onClose, organization, onSave }: EditOrganizationModalProps) {
    const [name, setName] = useState('')
    const [isLoading, setIsLoading] = useState(false)

    // Load the selected organization's name every time the modal opens
    useEffect(() => {
        if (isOpen) setName(organization?.name || '')
    }, [isOpen, organization])

    const handleSubmit = async () => {
        if (!name.trim()) return
        setIsLoading(true)
        try {
            await onSave({ name: name.trim() })
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
            title="Edit organization"
            footer={
                <>
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSubmit} disabled={!name.trim() || isLoading}>
                        {isLoading && <Loader2 className="animate-spin" />}
                        Save changes
                    </button>
                </>
            }
        >
            <form
                onSubmit={(e) => {
                    e.preventDefault()
                    handleSubmit()
                }}
            >
                <label className="label" htmlFor="eo-name">Organization name</label>
                <input id="eo-name" className="field" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </form>
        </Modal>
    )
}
