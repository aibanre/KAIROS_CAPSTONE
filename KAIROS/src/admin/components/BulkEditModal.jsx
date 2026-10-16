import { useState } from 'react'
import AdminModal from './AdminModal.jsx'
import ImagePicker from './ImagePicker.jsx'

export default function BulkEditModal({
    title,
    entityLabel,
    selectedCount,
    fields,
    request,
    error,
    isSaving,
    onSave,
    onClose,
}) {
    const [enabledFields, setEnabledFields] = useState({})
    const [values, setValues] = useState({})
    const hasChanges = Object.values(enabledFields).some(Boolean)
    const requiredFieldsMissing = fields.some((field) => enabledFields[field.name]
        && field.required
        && (values[field.name] === undefined || values[field.name] === ''))
    const saveDisabled = !hasChanges || requiredFieldsMissing || isSaving

    const toggleField = (field, enabled) => {
        if (field.disabled) return
        setEnabledFields((current) => ({ ...current, [field.name]: enabled }))
        if (!enabled) {
            setValues((current) => {
                const next = { ...current }
                delete next[field.name]
                return next
            })
        }
    }

    const updateValue = (fieldName, value) => {
        setValues((current) => ({ ...current, [fieldName]: value }))
    }

    const close = () => onClose(hasChanges)
    const save = (event) => {
        event.preventDefault()
        const changes = Object.fromEntries(fields
            .filter((field) => enabledFields[field.name])
            .map((field) => [field.name, values[field.name]]))
        onSave(changes)
    }

    return (
        <AdminModal
            title={title}
            labelledBy="bulk-edit-modal-title"
            onClose={close}
            footer={<>
                <button type="button" disabled={isSaving} onClick={close} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 disabled:opacity-50">Cancel</button>
                <button type="submit" form="bulk-edit-form" disabled={saveDisabled} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50">{isSaving ? 'Updating...' : `Review update for ${selectedCount}`}</button>
            </>}
        >
            <form id="bulk-edit-form" onSubmit={save} className="space-y-4">
                <p className="text-sm text-slate-600">Choose only the fields to change for these {entityLabel}. Unselected fields will be left unchanged.</p>
                {error ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{error}</p> : null}
                {fields.map((field) => {
                    const enabled = Boolean(enabledFields[field.name])
                    return <section key={field.name} className={`rounded-xl border p-4 ${field.disabled ? 'border-slate-200 bg-slate-100' : 'border-slate-200 bg-white'}`}>
                        <div className="flex items-center justify-between gap-3">
                            <label htmlFor={`bulk-field-${field.name}`} className="text-sm font-semibold text-slate-700">{field.label}</label>
                            <label className={`inline-flex items-center gap-2 text-xs ${field.disabled ? 'text-slate-400' : 'text-slate-600'}`}>
                                <input type="checkbox" checked={enabled} disabled={field.disabled || isSaving} onChange={(event) => toggleField(field, event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 disabled:opacity-50" />
                                {enabled ? 'Change' : 'Leave unchanged'}
                            </label>
                        </div>
                        {field.disabled ? null : enabled && field.type === 'image' ? <ImagePicker
                            request={request}
                            selectedUrl={values[field.name] || ''}
                            currentUrl={null}
                            hasPendingFile={false}
                            onSelect={(url) => updateValue(field.name, url)}
                            onRemove={() => toggleField(field, false)}
                        /> : enabled && field.type === 'textarea' ? <textarea
                            id={`bulk-field-${field.name}`}
                            value={values[field.name] ?? ''}
                            onChange={(event) => updateValue(field.name, event.target.value)}
                            rows="3"
                            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-500"
                        /> : enabled && field.type === 'select' ? <select
                            id={`bulk-field-${field.name}`}
                            value={values[field.name] ?? ''}
                            onChange={(event) => updateValue(field.name, event.target.value)}
                            className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-500"
                        >
                            <option value="">Choose {field.label.toLowerCase()}</option>
                            {field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select> : enabled ? <input
                            id={`bulk-field-${field.name}`}
                            type={field.type || 'text'}
                            value={values[field.name] ?? ''}
                            min={field.min}
                            max={field.max}
                            step={field.step}
                            onChange={(event) => updateValue(field.name, event.target.value)}
                            className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-500"
                        /> : <p className="mt-2 text-xs text-slate-400">{field.disabled ? 'Not available for this selection.' : 'Leave unchanged'}</p>}
                        {field.disabled && field.note ? <p className="mt-2 text-xs text-slate-500">{field.note}</p> : null}
                    </section>
                })}
            </form>
        </AdminModal>
    )
}
