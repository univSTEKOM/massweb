import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import Image from '@tiptap/extension-image'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell } from '@tiptap/extension-table-cell'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { common, createLowlight } from 'lowlight'
import { useEffect, useState } from 'react'
import { Modal } from './Modal'
import { Button } from '@heroui/react'
import {
    Bold, Italic, Underline as UnderlineIcon, Code, List, ListOrdered,
    Heading1, Heading2, Heading3, Link as LinkIcon, Image as ImageIcon,
    Table as TableIcon, AlignLeft, AlignCenter, AlignRight, Code2, Eye
} from 'lucide-react'

interface RichTextEditorProps {
    value: string
    onChange: (html: string) => void
    label?: string
}

const lowlight = createLowlight(common)

export function RichTextEditor({ value, onChange, label }: RichTextEditorProps) {
    const [isHtmlMode, setIsHtmlMode] = useState(false)
    const [htmlContent, setHtmlContent] = useState(value)
    // Link / image URL dialog (replaces window.prompt)
    const [urlDialog, setUrlDialog] = useState<{ kind: 'link' | 'image'; url: string } | null>(null)

    const editor = useEditor({
        extensions: [
            StarterKit.configure({ codeBlock: false }),
            Link.configure({ openOnClick: false }),
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            Underline,
            Image,
            Table.configure({ resizable: true }),
            TableRow,
            TableHeader,
            TableCell,
            CodeBlockLowlight.configure({ lowlight }),
        ],
        content: value,
        onUpdate: ({ editor }) => {
            const html = editor.getHTML()
            onChange(html)
            setHtmlContent(html)
        },
        editorProps: {
            attributes: {
                class: 'prose prose-sm max-w-none focus:outline-none min-h-[400px] p-4 text-gray-900 dark:text-gray-100',
            },
        },
    })

    // Follow external value changes (async-loaded content, template fill-in).
    // Edits made in the editor round-trip through onChange, so they match and are skipped.
    useEffect(() => {
        if (!editor || editor.isDestroyed) return
        if ((value || '') !== editor.getHTML()) {
            editor.commands.setContent(value || '', { emitUpdate: false })
            setHtmlContent(value || '')
        }
    }, [value, editor])

    const addLink = () => {
        setUrlDialog({ kind: 'link', url: (editor?.getAttributes('link').href as string) || '' })
    }

    const applyUrl = () => {
        if (!urlDialog || !editor) return
        const url = urlDialog.url.trim()
        if (urlDialog.kind === 'link') {
            if (url) editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
            else editor.chain().focus().extendMarkRange('link').unsetLink().run()
        } else if (url) {
            editor.chain().focus().setImage({ src: url }).run()
        }
        setUrlDialog(null)
    }

    const addImage = () => {
        setUrlDialog({ kind: 'image', url: '' })
    }

    const addTable = () => {
        if (editor) editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
    }

    const toggleHtmlMode = () => {
        if (!isHtmlMode && editor) {
            setHtmlContent(editor.getHTML())
            setIsHtmlMode(true)
        } else {
            if (editor) {
                editor.commands.setContent(htmlContent)
                onChange(htmlContent)
            }
            setIsHtmlMode(false)
        }
    }

    const handleHtmlChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setHtmlContent(e.target.value)
        onChange(e.target.value)
    }

    if (!editor) return null

    return (
        <div className="space-y-2">
            {label && <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>}

            {!isHtmlMode && (
                <div className="border border-gray-300 dark:border-gray-600 rounded-t-lg bg-gray-50 dark:bg-gray-800 p-2 flex flex-wrap gap-1">
                    <div className="flex gap-1 border-r border-gray-300 pr-2">
                        <Button size="sm" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={`${editor.isActive('heading', { level: 1 }) ? 'bg-gray-300' : 'bg-transparent'} text-gray-800 dark:text-gray-200`}><Heading1 className="w-4 h-4" /></Button>
                        <Button size="sm" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={`${editor.isActive('heading', { level: 2 }) ? 'bg-gray-300' : 'bg-transparent'} text-gray-800 dark:text-gray-200`}><Heading2 className="w-4 h-4" /></Button>
                        <Button size="sm" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={`${editor.isActive('heading', { level: 3 }) ? 'bg-gray-300' : 'bg-transparent'} text-gray-800 dark:text-gray-200`}><Heading3 className="w-4 h-4" /></Button>
                    </div>

                    <div className="flex gap-1 border-r border-gray-300 pr-2">
                        <Button size="sm" onClick={() => editor.chain().focus().toggleBold().run()} className={`${editor.isActive('bold') ? 'bg-gray-300' : 'bg-transparent'} text-gray-800 dark:text-gray-200`}><Bold className="w-4 h-4" /></Button>
                        <Button size="sm" onClick={() => editor.chain().focus().toggleItalic().run()} className={`${editor.isActive('italic') ? 'bg-gray-300' : 'bg-transparent'} text-gray-800 dark:text-gray-200`}><Italic className="w-4 h-4" /></Button>
                        <Button size="sm" onClick={() => editor.chain().focus().toggleUnderline().run()} className={`${editor.isActive('underline') ? 'bg-gray-300' : 'bg-transparent'} text-gray-800 dark:text-gray-200`}><UnderlineIcon className="w-4 h-4" /></Button>
                        <Button size="sm" onClick={() => editor.chain().focus().toggleCode().run()} className={`${editor.isActive('code') ? 'bg-gray-300' : 'bg-transparent'} text-gray-800 dark:text-gray-200`}><Code className="w-4 h-4" /></Button>
                    </div>

                    <div className="flex gap-1 border-r border-gray-300 pr-2">
                        <Button size="sm" onClick={() => editor.chain().focus().toggleBulletList().run()} className={`${editor.isActive('bulletList') ? 'bg-gray-300' : 'bg-transparent'} text-gray-800 dark:text-gray-200`}><List className="w-4 h-4" /></Button>
                        <Button size="sm" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={`${editor.isActive('orderedList') ? 'bg-gray-300' : 'bg-transparent'} text-gray-800 dark:text-gray-200`}><ListOrdered className="w-4 h-4" /></Button>
                    </div>

                    <div className="flex gap-1 border-r border-gray-300 pr-2">
                        <Button size="sm" onClick={addLink} className="bg-transparent text-gray-800 dark:text-gray-200"><LinkIcon className="w-4 h-4" /></Button>
                        <Button size="sm" onClick={addImage} className="bg-transparent text-gray-800 dark:text-gray-200"><ImageIcon className="w-4 h-4" /></Button>
                        <Button size="sm" onClick={addTable} className="bg-transparent text-gray-800 dark:text-gray-200"><TableIcon className="w-4 h-4" /></Button>
                        <Button size="sm" onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={`${editor.isActive('codeBlock') ? 'bg-gray-300' : 'bg-transparent'} text-gray-800 dark:text-gray-200`}><Code2 className="w-4 h-4" /></Button>
                    </div>

                    <div className="flex gap-1">
                        <Button size="sm" onClick={() => editor.chain().focus().setTextAlign('left').run()} className={`${editor.isActive({ textAlign: 'left' }) ? 'bg-gray-300' : 'bg-transparent'} text-gray-800 dark:text-gray-200`}><AlignLeft className="w-4 h-4" /></Button>
                        <Button size="sm" onClick={() => editor.chain().focus().setTextAlign('center').run()} className={`${editor.isActive({ textAlign: 'center' }) ? 'bg-gray-300' : 'bg-transparent'} text-gray-800 dark:text-gray-200`}><AlignCenter className="w-4 h-4" /></Button>
                        <Button size="sm" onClick={() => editor.chain().focus().setTextAlign('right').run()} className={`${editor.isActive({ textAlign: 'right' }) ? 'bg-gray-300' : 'bg-transparent'} text-gray-800 dark:text-gray-200`}><AlignRight className="w-4 h-4" /></Button>
                    </div>
                </div>
            )}

            <div className="relative">
                {isHtmlMode ? (
                    <textarea value={htmlContent} onChange={handleHtmlChange} className="w-full min-h-[400px] p-4 border border-gray-300 dark:border-gray-600 rounded-b-lg font-mono text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="HTML code..." />
                ) : (
                    <div className="border border-gray-300 dark:border-gray-600 rounded-b-lg bg-white dark:bg-gray-900">
                        <EditorContent editor={editor} />
                    </div>
                )}
            </div>

            <div className="flex justify-end">
                <Button size="sm" onClick={toggleHtmlMode} className="bg-gray-200 hover:bg-gray-300 text-gray-800">
                    {isHtmlMode ? (<><Eye className="w-4 h-4 mr-2" />Visual Mode</>) : (<><Code2 className="w-4 h-4 mr-2" />HTML Mode</>)}
                </Button>
            </div>

            <Modal
                open={!!urlDialog}
                onClose={() => setUrlDialog(null)}
                size="sm"
                title={urlDialog?.kind === 'image' ? 'Insert image' : 'Add link'}
                footer={
                    <>
                        <button type="button" className="btn btn-secondary" onClick={() => setUrlDialog(null)}>Cancel</button>
                        <button type="button" className="btn btn-primary" onClick={applyUrl}>
                            {urlDialog?.kind === 'image' ? 'Insert' : urlDialog?.url.trim() ? 'Apply' : 'Remove link'}
                        </button>
                    </>
                }
            >
                <form onSubmit={(e) => { e.preventDefault(); applyUrl() }}>
                    <label className="label" htmlFor="rte-url">{urlDialog?.kind === 'image' ? 'Image URL' : 'URL'}</label>
                    <input
                        id="rte-url"
                        className="field"
                        type="url"
                        placeholder="https://"
                        value={urlDialog?.url ?? ''}
                        onChange={(e) => setUrlDialog((d) => (d ? { ...d, url: e.target.value } : d))}
                        autoFocus
                    />
                    {urlDialog?.kind === 'link' && <p className="hint">Select text first to turn it into a link. Leave empty to remove the link.</p>}
                </form>
            </Modal>
        </div>
    )
}
