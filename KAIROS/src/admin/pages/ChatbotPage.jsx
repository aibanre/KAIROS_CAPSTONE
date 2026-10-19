import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_URL as API_BASE_URL } from '../../config/api.js'
import { FaBookOpen, FaChevronDown, FaChevronUp, FaEdit, FaPlus, FaTimes, FaTrash } from 'react-icons/fa'
import { formatDateTime } from '../utils/formatDate.js'
import { useAdminToast } from '../context/AdminNotificationsContext.jsx'
import { notifyAdminActionError } from '../utils/adminToastMessages.js'

const API_URL = `${API_BASE_URL}/api/admin/chatbot`

function Panel({ title, children, action }) {
    return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.10)]"><div className="flex items-start justify-between gap-4"><h2 className="text-xl font-semibold text-slate-800">{title}</h2>{action}</div>{children}</section>
}

function CardState({ loading, error, empty, children }) {
    if (loading) return <p className="mt-4 text-sm text-slate-500">Loading...</p>
    if (error) return <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{error}</p>
    if (empty) return <p className="mt-4 rounded-lg bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">No records found.</p>
    return children
}

function Modal({ title, onClose, children }) {
    return <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4" role="presentation"><div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl sm:p-6" role="dialog" aria-modal="true"><div className="flex items-center justify-between"><h2 className="min-w-0 truncate text-lg font-bold text-slate-800">{title}</h2><button type="button" onClick={onClose} aria-label="Close" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"><FaTimes /></button></div>{children}</div></div>
}

function formatDate(value) {
    return formatDateTime(value)
}

export default function ChatbotPage() {
    const navigate = useNavigate()
    const toast = useAdminToast()
    const [faqs, setFaqs] = useState([])
    const [unanswered, setUnanswered] = useState([])
    const [knowledge, setKnowledge] = useState([])
    const [conversations, setConversations] = useState([])
    const [stats, setStats] = useState(null)
    const [cardState, setCardState] = useState({ faqs: { loading: true }, unanswered: { loading: true }, knowledge: { loading: true }, conversations: { loading: true } })
    const [notice, setNotice] = useState('')
    const [modal, setModal] = useState(null)
    const [conversation, setConversation] = useState(null)
    const [conversationError, setConversationError] = useState('')
    const [conversationFilters, setConversationFilters] = useState({ search: '', answered: '', page: 1 })
    const [conversationTotal, setConversationTotal] = useState(0)

    const request = async (path, options = {}) => {
        const response = await fetch(`${API_URL}${path}`, { ...options, credentials: 'include', headers: { 'Content-Type': 'application/json', ...options.headers } })
        const data = await response.json().catch(() => ({}))
        if (response.status === 401 || response.status === 403) {
            navigate(`/admin/login?redirect=${encodeURIComponent('/admin/chatbot')}`, { replace: true })
            throw new Error('Your admin session has expired.')
        }
        if (!response.ok) throw new Error(data.error || 'Unable to complete chatbot request.')
        return data
    }

    const loadCard = async (name, path, assign) => {
        setCardState((current) => ({ ...current, [name]: { loading: true } }))
        try {
            const data = await request(path)
            assign(data)
            setCardState((current) => ({ ...current, [name]: { loading: false } }))
        } catch (error) {
            setCardState((current) => ({ ...current, [name]: { loading: false, error: error.message } }))
        }
    }

    const loadFaqs = () => loadCard('faqs', '/faqs', (data) => setFaqs((data.faqs || []).map((faq) => ({ id: faq.faq_id, question: faq.question, answer: faq.answer, active: Boolean(faq.is_active), order: faq.sort_order }))))
    const loadUnanswered = () => loadCard('unanswered', '/unanswered', (data) => setUnanswered((data.unanswered || []).map((item) => ({ id: item.unanswered_id, question: item.question_text, timesAsked: item.times_asked, status: item.status }))))
    const loadKnowledge = () => loadCard('knowledge', '/knowledge', (data) => setKnowledge((data.knowledge || []).map((item) => ({ id: item.knowledge_id, key: item.topic_key, title: item.title, content: item.content, live: Boolean(item.is_live) }))))
    const loadConversations = () => {
        const query = new URLSearchParams({ page: String(conversationFilters.page), limit: '10' })
        if (conversationFilters.search) query.set('search', conversationFilters.search)
        if (conversationFilters.answered) query.set('answered', conversationFilters.answered)
        return loadCard('conversations', `/conversations?${query}`, (data) => { setConversations((data.conversations || []).map((item) => ({ id: item.conversation_id, guest: item.customer_name, time: item.updated_at, question: item.first_message, unanswered: Number(item.unanswered_count) > 0 }))); setConversationTotal(Number(data.total || 0)) })
    }

    useEffect(() => { loadFaqs(); loadUnanswered(); loadKnowledge(); loadCard('conversations', '/conversations?page=1&limit=10', (data) => { setConversations((data.conversations || []).map((item) => ({ id: item.conversation_id, guest: item.customer_name, time: item.updated_at, question: item.first_message, unanswered: Number(item.unanswered_count) > 0 }))); setConversationTotal(Number(data.total || 0)) }); request('/stats').then(setStats).catch(() => {}) }, [])
    useEffect(() => { if (conversationFilters.page !== 1 || conversationFilters.search || conversationFilters.answered) loadConversations() }, [conversationFilters])

    const save = async (path, options, reload, successMessage = 'Saved successfully.') => {
        setNotice('')
        try {
            await request(path, options)
            setModal(null)
            await reload()
            toast.success(successMessage)
        } catch (error) {
            notifyAdminActionError(toast, error, 'Unable to save the chatbot changes.')
        }
    }
    const openFaq = (faq = null, question = '', unansweredId = null) => setModal({ type: 'faq', id: faq?.id || null, unansweredId, question: faq?.question || question, answer: faq?.answer || '' })
    const reorder = (index, direction) => {
        const next = [...faqs]
        const target = index + direction
        if (target < 0 || target >= next.length) return
        ;[next[index], next[target]] = [next[target], next[index]]
        setFaqs(next)
        save('/faqs/reorder', { method: 'PATCH', body: JSON.stringify({ items: next.map((item, itemIndex) => ({ faq_id: item.id, sort_order: (itemIndex + 1) * 10 })) }) }, loadFaqs, 'FAQ order updated successfully.')
    }

    return <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-bold text-slate-800">Chatbot Management</h1>{stats ? <div className="grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4"><span className="rounded-lg bg-white px-3 py-2 text-slate-600"><b className="block text-lg text-sky-700">{stats.total_faqs}</b>FAQs</span><span className="rounded-lg bg-white px-3 py-2 text-slate-600"><b className="block text-lg text-amber-600">{stats.open_unanswered}</b>Open</span><span className="rounded-lg bg-white px-3 py-2 text-slate-600"><b className="block text-lg text-slate-700">{stats.conversations_week}</b>This week</span><span className="rounded-lg bg-white px-3 py-2 text-slate-600"><b className="block text-lg text-emerald-600">{stats.answer_rate}%</b>Answer rate</span></div> : null}</div>
        {notice ? <p className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{notice}</p> : null}
        <div className="grid gap-5 lg:grid-cols-2">
            <Panel title={<span>Frequently Asked<br />Questions</span>} action={<button type="button" onClick={() => openFaq()} className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"><FaPlus className="h-3 w-3" />Add FAQ</button>}>
                <CardState {...cardState.faqs} empty={!faqs.length}><div className="mt-4 space-y-2">{faqs.filter((faq) => faq.active).map((faq, index) => <div key={faq.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-700"><span>{faq.question}</span><div className="flex items-center gap-2"><button type="button" onClick={() => reorder(index, -1)} title="Move up" className="text-slate-400 hover:text-sky-600"><FaChevronUp /></button><button type="button" onClick={() => reorder(index, 1)} title="Move down" className="text-slate-400 hover:text-sky-600"><FaChevronDown /></button><button type="button" onClick={() => openFaq(faq)} title="Edit FAQ" className="text-sky-500 hover:text-sky-700"><FaEdit /></button><button type="button" onClick={() => window.confirm('Deactivate this FAQ?') && save(`/faqs/${faq.id}/deactivate`, { method: 'PATCH' }, loadFaqs, 'FAQ deactivated successfully.')} title="Deactivate FAQ" className="text-rose-400 hover:text-rose-600"><FaTrash /></button></div></div>)}</div></CardState>
            </Panel>
            <Panel title="Unanswered Questions"><CardState {...cardState.unanswered} empty={!unanswered.length}><div className="mt-4 space-y-2">{unanswered.filter((item) => item.status === 'open').map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-800"><span>{item.question}<small className="mt-1 block text-xs text-amber-600">Asked {item.timesAsked} time{item.timesAsked === 1 ? '' : 's'}</small></span><div className="flex shrink-0 gap-2"><button type="button" onClick={() => openFaq(null, item.question, item.id)} className="rounded-xl bg-amber-500 px-3 py-1.5 font-medium text-white hover:bg-amber-600">Add</button><button type="button" onClick={() => save(`/unanswered/${item.id}/dismiss`, { method: 'PATCH' }, loadUnanswered, 'Question dismissed successfully.')} className="rounded-xl border border-amber-400 px-3 py-1.5 text-amber-700 hover:bg-amber-100">Dismiss</button></div></div>)}</div></CardState></Panel>
            <Panel title="Conversation History"><div className="mt-4 flex flex-wrap gap-2"><input value={conversationFilters.search} onChange={(event) => setConversationFilters((current) => ({ ...current, search: event.target.value, page: 1 }))} placeholder="Search guest" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" /><select value={conversationFilters.answered} onChange={(event) => setConversationFilters((current) => ({ ...current, answered: event.target.value, page: 1 }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="">All answers</option><option value="true">Answered</option><option value="false">Unanswered</option></select></div><CardState {...cardState.conversations} empty={!conversations.length}><div className="mt-3 space-y-3">{conversations.map((item) => <button type="button" key={item.id} onClick={() => request(`/conversations/${item.id}`).then((data) => setConversation({ ...item, messages: data.messages || [] })).catch((error) => setNotice(error.message))} className="block w-full rounded-xl border border-slate-200 px-3 py-3 text-left hover:bg-sky-50"><div className="flex justify-between gap-3 text-xs text-slate-400"><span>{item.guest}</span><span>{formatDate(item.time)}</span></div><p className="mt-2 text-sm text-slate-700">{item.question || 'No messages'}</p>{item.unanswered ? <span className="mt-2 inline-block text-xs font-semibold text-amber-700">Bot could not answer</span> : null}</button>)}</div><div className="mt-4 flex justify-between text-xs text-slate-500"><button type="button" disabled={conversationFilters.page <= 1} onClick={() => setConversationFilters((current) => ({ ...current, page: current.page - 1 }))}>Previous</button><span>Page {conversationFilters.page} · {conversationTotal} total</span><button type="button" disabled={conversationFilters.page * 10 >= conversationTotal} onClick={() => setConversationFilters((current) => ({ ...current, page: current.page + 1 }))}>Next</button></div></CardState></Panel>
            <Panel title="Knowledge Base"><CardState {...cardState.knowledge} empty={!knowledge.length}><div className="mt-4 space-y-1">{knowledge.map((item) => <div key={item.key} className="flex items-center justify-between gap-3 px-2 py-2.5 text-sm text-slate-700"><span className="flex items-center gap-3"><FaBookOpen className="text-sky-500" /><span>{item.title}{item.live ? <small className="ml-2 rounded bg-slate-100 px-2 py-1 text-[10px] text-slate-500">Generated from live data</small> : null}</span></span>{item.live ? null : <button type="button" onClick={() => setModal({ type: 'knowledge', ...item })} title="Edit knowledge topic" className="text-sky-500 hover:text-sky-700"><FaEdit /></button>}</div>)}</div></CardState></Panel>
        </div>
        {modal?.type === 'faq' ? <Modal title={modal.id ? 'Edit FAQ' : 'Add FAQ'} onClose={() => setModal(null)}><form className="mt-4 space-y-3" onSubmit={(event) => { event.preventDefault(); const body = JSON.stringify({ question: modal.question, answer: modal.answer }); if (modal.unansweredId) save(`/unanswered/${modal.unansweredId}/promote`, { method: 'POST', body: JSON.stringify({ answer: modal.answer }) }, async () => { await loadFaqs(); await loadUnanswered() }); else save(modal.id ? `/faqs/${modal.id}` : '/faqs', { method: modal.id ? 'PUT' : 'POST', body }, loadFaqs) }}><label className="block text-sm font-medium text-slate-600">Question<input required maxLength="255" value={modal.question} readOnly={Boolean(modal.unansweredId)} onChange={(event) => setModal((current) => ({ ...current, question: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 read-only:bg-slate-50" /></label><label className="block text-sm font-medium text-slate-600">Answer<textarea required maxLength="10000" value={modal.answer} onChange={(event) => setModal((current) => ({ ...current, answer: event.target.value }))} className="mt-1 min-h-28 w-full rounded-lg border border-slate-300 px-3 py-2" /></label><button className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white">{modal.unansweredId ? 'Promote to FAQ' : 'Save FAQ'}</button></form></Modal> : null}
        {modal?.type === 'knowledge' ? <Modal title={`Edit ${modal.title}`} onClose={() => setModal(null)}><form className="mt-4 space-y-3" onSubmit={(event) => { event.preventDefault(); save(`/knowledge/${modal.id}`, { method: 'PUT', body: JSON.stringify({ title: modal.title, content: modal.content }) }, loadKnowledge) }}><label className="block text-sm font-medium text-slate-600">Title<input required maxLength="150" value={modal.title} onChange={(event) => setModal((current) => ({ ...current, title: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label><label className="block text-sm font-medium text-slate-600">Content<textarea required maxLength="20000" value={modal.content} onChange={(event) => setModal((current) => ({ ...current, content: event.target.value }))} className="mt-1 min-h-40 w-full rounded-lg border border-slate-300 px-3 py-2" /></label><button className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white">Save topic</button></form></Modal> : null}
        {conversation ? <Modal title={`Conversation with ${conversation.guest}`} onClose={() => setConversation(null)}><div className="mt-4 max-h-[60vh] space-y-3 overflow-y-auto">{conversation.messages.map((message) => <div key={message.message_id} className={`rounded-lg px-3 py-2 text-sm ${message.role === 'user' ? 'bg-slate-100 text-slate-700' : 'bg-sky-50 text-slate-800'}`}><div className="mb-1 text-[10px] font-semibold uppercase text-slate-400">{message.role === 'user' ? 'Customer' : message.was_answered === false ? 'Bot · unanswered' : 'Bot'}</div>{message.content}</div>)}</div></Modal> : null}
    </div>
}
