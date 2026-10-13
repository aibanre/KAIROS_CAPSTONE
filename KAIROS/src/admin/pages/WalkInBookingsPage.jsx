import { API_URL } from '../../config/api.js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FaCamera, FaCalendarCheck, FaRedo, FaUserPlus } from 'react-icons/fa'

const API_ROOT = `${API_URL}/api`
const today = new Date().toISOString().slice(0, 10)

const initialForm = {
    type: 'room',
    checkIn: '',
    checkOut: '',
    eventDate: '',
    startTime: '',
    packageId: '',
    extraHours: '0',
    numGuests: '1',
    resourceId: '',
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    notes: '',
    totalAmount: '',
    paymentMethodId: '',
    amountReceived: '',
}

const NO_RECEIPT_METHOD_TYPES = ['cash', 'card']

function mapResource(resource, type) {
    return type === 'room'
        ? { id: resource.room_id, name: resource.room_number, kind: resource.room_type, capacity: resource.capacity, price: Number(resource.price_per_night) }
        : { id: resource.venue_id, name: resource.venue_name, kind: resource.venue_type, capacity: resource.capacity, price: null, bookingMode: resource.booking_mode, startTime: resource.start_time, earliestStart: resource.earliest_start, latestEnd: resource.latest_end }
}

function hourlyStartTimes(resource) {
    const [earliestHour = '08', earliestMinute = '00'] = String(resource?.earliestStart || '08:00').split(':')
    const [latestHour = '22', latestMinute = '00'] = String(resource?.latestEnd || '22:00').split(':')
    const first = Math.ceil((Number(earliestHour) * 60 + Number(earliestMinute || 0)) / 60)
    const last = Math.floor((Number(latestHour) * 60 + Number(latestMinute || 0)) / 60)
    return Array.from({ length: Math.max(0, last - first) }, (_, index) => `${String(first + index).padStart(2, '0')}:00`)
}

function formatPrice(value) {
    return value === null || value === undefined || Number.isNaN(Number(value))
        ? 'N/A'
        : `₱${Number(value).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function getNights(checkIn, checkOut) {
    if (!checkIn || !checkOut) return 0
    return Math.round((Date.parse(`${checkOut}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`)) / 86400000)
}

function FieldError({ message }) {
    return message ? <span className="mt-1 block text-xs font-normal text-rose-600" role="alert">{message}</span> : null
}

function InputField({ label, error, ...props }) {
    return <label className="text-xs font-semibold text-slate-600">
        {label}
        <input {...props} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-sky-500" />
        <FieldError message={error} />
    </label>
}

function ReceiptCapture({ file, onFileChange }) {
    const videoRef = useRef(null)
    const streamRef = useRef(null)
    const [cameraState, setCameraState] = useState('starting')
    const [previewUrl, setPreviewUrl] = useState(file ? URL.createObjectURL(file) : '')

    const stopCamera = () => {
        streamRef.current?.getTracks().forEach((track) => track.stop())
        streamRef.current = null
    }

    useEffect(() => {
        let isMounted = true
        const startCamera = async () => {
            if (!navigator.mediaDevices?.getUserMedia) {
                setCameraState('fallback')
                return
            }
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
                if (!isMounted) {
                    stream.getTracks().forEach((track) => track.stop())
                    return
                }
                streamRef.current = stream
                videoRef.current.srcObject = stream
                setCameraState('ready')
            } catch {
                if (isMounted) setCameraState('fallback')
            }
        }
        startCamera()
        return () => {
            isMounted = false
            stopCamera()
            if (previewUrl) URL.revokeObjectURL(previewUrl)
        }
    }, [])

    const setReceiptFile = (nextFile) => {
        if (!nextFile) return
        if (previewUrl) URL.revokeObjectURL(previewUrl)
        setPreviewUrl(URL.createObjectURL(nextFile))
        onFileChange(nextFile)
    }

    const capturePhoto = () => {
        const video = videoRef.current
        if (!video || !video.videoWidth) return
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        canvas.getContext('2d').drawImage(video, 0, 0)
        canvas.toBlob((blob) => {
            if (blob) setReceiptFile(new File([blob], `walk-in-receipt-${Date.now()}.jpg`, { type: 'image/jpeg' }))
        }, 'image/jpeg', 0.9)
        stopCamera()
        setCameraState('captured')
    }

    const retake = async () => {
        onFileChange(null)
        if (previewUrl) URL.revokeObjectURL(previewUrl)
        setPreviewUrl('')
        setCameraState('starting')
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
            streamRef.current = stream
            videoRef.current.srcObject = stream
            setCameraState('ready')
        } catch {
            setCameraState('fallback')
        }
    }

    return <div className="mt-4 space-y-3">
        {cameraState === 'ready' || cameraState === 'starting' ? <><video ref={videoRef} autoPlay playsInline muted className="max-h-64 w-full rounded-lg bg-slate-900 object-contain" /><div className="flex gap-2"><button type="button" onClick={capturePhoto} disabled={cameraState !== 'ready'} className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"><FaCamera />Capture</button></div></> : null}
        {cameraState === 'fallback' ? <label className="block rounded-lg border border-dashed border-slate-300 px-4 py-4 text-center text-xs text-slate-500"><span className="font-semibold text-slate-700">Take or choose receipt photo</span><input type="file" accept="image/*" capture="environment" onChange={(event) => setReceiptFile(event.target.files[0])} className="mt-2 block w-full text-xs" /></label> : null}
        {file && previewUrl ? <div className="relative"><img src={previewUrl} alt="Receipt preview" className="max-h-64 w-full rounded-lg border border-slate-200 object-contain" /><button type="button" onClick={retake} className="mt-2 inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-600"><FaRedo />Retake</button></div> : null}
    </div>
}

export default function WalkInBookingsPage({ onBookingCreated }) {
    const navigate = useNavigate()
    const [form, setForm] = useState(initialForm)
    const [resources, setResources] = useState([])
    const [venuePackages, setVenuePackages] = useState([])
    const [paymentMethods, setPaymentMethods] = useState([])
    const [isLoadingAvailability, setIsLoadingAvailability] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')
    const [fieldErrors, setFieldErrors] = useState({})
    const [receiptFile, setReceiptFile] = useState(null)

    const request = async (url, options = {}) => {
        const response = await fetch(url, {
            ...options,
            credentials: 'include',
            headers: options.body instanceof FormData ? { ...options.headers } : { 'Content-Type': 'application/json', ...options.headers },
        })
        const data = await response.json().catch(() => ({}))
        if (response.status === 401 || response.status === 403) {
            navigate('/admin/login', { replace: true })
            throw new Error('Your admin session has expired.')
        }
        if (!response.ok) throw new Error(data.error || 'Unable to complete the walk-in booking request.')
        return data
    }

    useEffect(() => {
        request(`${API_ROOT}/admin/walk-in/payment-methods`)
            .then((data) => setPaymentMethods(data.paymentMethods || []))
            .catch((loadError) => setError(loadError.message))
    }, [])

    const availabilityKey = form.type === 'room'
        ? `${form.type}:${form.checkIn}:${form.checkOut}`
        : `${form.type}:${form.eventDate}`

    useEffect(() => {
        const hasDates = form.type === 'room' ? form.checkIn && form.checkOut && form.checkOut > form.checkIn : form.eventDate
        if (!hasDates) {
            setResources([])
            return undefined
        }

        let isCurrent = true
        const params = new URLSearchParams({ type: form.type })
        if (form.type === 'room') {
            params.set('check_in', form.checkIn)
            params.set('check_out', form.checkOut)
        } else {
            params.set('event_date', form.eventDate)
        }

        setIsLoadingAvailability(true)
        setError('')
        request(`${API_ROOT}/admin/walk-in/availability?${params.toString()}`)
            .then((data) => { if (isCurrent) setResources((data.items || []).map((item) => mapResource(item, form.type))) })
            .catch((loadError) => { if (isCurrent) setError(loadError.message) })
            .finally(() => { if (isCurrent) setIsLoadingAvailability(false) })
        return () => { isCurrent = false }
    }, [availabilityKey])

    const selectedResource = useMemo(
        () => resources.find((resource) => String(resource.id) === String(form.resourceId)) || null,
        [resources, form.resourceId]
    )
    useEffect(() => {
        if (form.type !== 'venue' || !form.resourceId) {
            setVenuePackages([])
            return undefined
        }
        let isCurrent = true
        request(`${API_ROOT}/venues/${encodeURIComponent(form.resourceId)}/packages`)
            .then((data) => { if (isCurrent) setVenuePackages(data.packages || []) })
            .catch((loadError) => { if (isCurrent) setError(loadError.message) })
        return () => { isCurrent = false }
    }, [form.type, form.resourceId])
    const selectedPackage = venuePackages.find((item) => String(item.package_id) === String(form.packageId))
    useEffect(() => {
        if (form.type === 'venue' && selectedResource && !form.startTime) {
            setForm((current) => ({ ...current, startTime: selectedResource.bookingMode === 'day_use' ? (selectedResource.startTime || '08:00') : '' }))
        }
    }, [form.type, form.startTime, selectedResource])
    const nights = getNights(form.checkIn, form.checkOut)
    const total = form.type === 'room'
        ? (selectedResource && nights > 0 ? selectedResource.price * nights : 0)
        : selectedPackage
            ? (selectedPackage.pricing_type === 'per_person' ? Number(selectedPackage.price) * Number(form.numGuests || 0) : Number(selectedPackage.price)) + Number(form.extraHours || 0) * Number(selectedPackage.extra_hour_rate || 0)
            : Number(form.totalAmount || 0)
    const selectedPaymentMethod = paymentMethods.find((method) => String(method.payment_method_id) === String(form.paymentMethodId))
    const methodType = selectedPaymentMethod?.method_type?.toLowerCase()
    const needsReceipt = Boolean(methodType && !NO_RECEIPT_METHOD_TYPES.includes(methodType))
    const isCash = methodType === 'cash'
    const amountReceived = Number(form.amountReceived)

    useEffect(() => {
        if (!selectedPaymentMethod || NO_RECEIPT_METHOD_TYPES.includes(selectedPaymentMethod.method_type?.toLowerCase())) setReceiptFile(null)
    }, [form.paymentMethodId, selectedPaymentMethod])

    const updateForm = (event) => {
        const { name, value, type, checked } = event.target
        setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value, ...(name === 'type' ? { resourceId: '', packageId: '', startTime: '', extraHours: '0' } : {}), ...(name === 'resourceId' ? { packageId: '', startTime: '', extraHours: '0' } : {}) }))
        setFieldErrors((current) => ({ ...current, [name]: '' }))
        setError('')
    }

    const validate = () => {
        const nextErrors = {}
        if (form.type === 'room') {
            if (!form.checkIn) nextErrors.checkIn = 'Check-in date is required.'
            if (!form.checkOut) nextErrors.checkOut = 'Check-out date is required.'
            if (form.checkIn && form.checkOut && form.checkOut <= form.checkIn) nextErrors.checkOut = 'Check-out must be after check-in.'
        } else if (!form.eventDate) nextErrors.eventDate = 'Event date is required.'
        if (!form.resourceId) nextErrors.resourceId = `Select an available ${form.type}.`
        if (form.type === 'venue' && selectedResource?.bookingMode === 'packaged' && !form.packageId) nextErrors.packageId = 'Select a venue package.'
        if (form.type === 'venue' && !form.startTime) nextErrors.startTime = 'Start time is required.'
        if (!form.numGuests || Number(form.numGuests) < 1 || !Number.isInteger(Number(form.numGuests))) nextErrors.numGuests = 'Enter a whole number greater than zero.'
        if (selectedResource && Number(form.numGuests) > selectedResource.capacity) nextErrors.numGuests = `Maximum capacity is ${selectedResource.capacity} guests.`
        if (!form.firstName.trim()) nextErrors.firstName = 'First name is required.'
        if (!form.lastName.trim()) nextErrors.lastName = 'Last name is required.'
        if (!form.phone.trim()) nextErrors.phone = 'Phone number is required.'
        if (!form.paymentMethodId) nextErrors.paymentMethodId = 'Select a payment method.'
        if (needsReceipt && !receiptFile) nextErrors.receipt = 'Receipt photo is required for this payment method.'
        setFieldErrors(nextErrors)
        return Object.keys(nextErrors).length === 0
    }

    const submitBooking = async (event) => {
        event.preventDefault()
        setNotice('')
        setError('')
        if (!validate()) return

        const payload = {
            type: form.type,
            num_guests: Number(form.numGuests),
            guest: { first_name: form.firstName.trim(), last_name: form.lastName.trim(), phone_number: form.phone.trim(), email: form.email.trim() || undefined },
            notes: form.notes.trim() || undefined,
        }
        if (form.type === 'room') {
            payload.room_id = Number(form.resourceId)
            payload.check_in = form.checkIn
            payload.check_out = form.checkOut
        } else {
            payload.venue_id = Number(form.resourceId)
            payload.event_date = form.eventDate
            payload.start_time = form.startTime
            payload.package_id = selectedPackage ? Number(form.packageId) : undefined
            payload.extra_hours = Number(form.extraHours || 0)
            payload.total_amount = total
        }
        payload.payment = { payment_method_id: Number(form.paymentMethodId), amount: total }

        setIsSubmitting(true)
        try {
            const formData = new FormData()
            formData.append('type', payload.type)
            formData.append('num_guests', String(payload.num_guests))
            formData.append('guest', JSON.stringify(payload.guest))
            formData.append('notes', payload.notes || '')
            if (payload.room_id) formData.append('room_id', String(payload.room_id))
            if (payload.venue_id) formData.append('venue_id', String(payload.venue_id))
            if (payload.check_in) formData.append('check_in', payload.check_in)
            if (payload.check_out) formData.append('check_out', payload.check_out)
            if (payload.event_date) formData.append('event_date', payload.event_date)
            if (payload.start_time) formData.append('start_time', payload.start_time)
            if (payload.package_id) formData.append('package_id', String(payload.package_id))
            if (payload.extra_hours !== undefined) formData.append('extra_hours', String(payload.extra_hours))
            if (payload.total_amount !== undefined) formData.append('total_amount', String(payload.total_amount))
            formData.append('payment', JSON.stringify(payload.payment))
            if (receiptFile) formData.append('proof_of_payment', receiptFile)
            const data = await request(`${API_ROOT}/admin/walk-in/bookings`, { method: 'POST', body: formData })
            setNotice(`Booking ${data.booking.booking_reference} created successfully.`)
            onBookingCreated?.(data.booking)
            setForm(initialForm)
            setResources([])
            setFieldErrors({})
            setReceiptFile(null)
        } catch (submitError) {
            setError(submitError.message)
        } finally {
            setIsSubmitting(false)
        }
    }

    return <div className="mx-auto max-w-6xl">
        <header className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100 text-sky-700"><FaUserPlus /></div>
            <div><h1 className="text-2xl font-bold text-slate-800">Walk-in Booking</h1><p className="text-sm text-slate-500">Create an on-site reservation for an arriving guest.</p></div>
        </header>

        {notice ? <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700" role="status">{notice}</p> : null}
        {error ? <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{error}</p> : null}

        <form onSubmit={submitBooking} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-5">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="mb-4 text-lg font-semibold text-slate-800">Stay or event</h2>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="text-xs font-semibold text-slate-600">Booking type<select name="type" value={form.type} onChange={updateForm} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-sky-500"><option value="room">Room</option><option value="venue">Venue</option></select></label>
                        {form.type === 'room' ? <><InputField label="Check-in" name="checkIn" type="date" min={today} value={form.checkIn} onChange={updateForm} error={fieldErrors.checkIn} /><InputField label="Check-out" name="checkOut" type="date" min={form.checkIn || today} value={form.checkOut} onChange={updateForm} error={fieldErrors.checkOut} /></> : <InputField label="Event date" name="eventDate" type="date" min={today} value={form.eventDate} onChange={updateForm} error={fieldErrors.eventDate} />}
                        <label className="text-xs font-semibold text-slate-600">Available {form.type}<select name="resourceId" value={form.resourceId} onChange={updateForm} disabled={isLoadingAvailability || resources.length === 0} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-sky-500 disabled:bg-slate-100"><option value="">{isLoadingAvailability ? 'Loading availability...' : resources.length ? `Select a ${form.type}` : 'Choose dates first'}</option>{resources.map((resource) => <option key={resource.id} value={resource.id}>{resource.name} · {resource.capacity} guests{resource.price !== null ? ` · ${formatPrice(resource.price)}/night` : ''}</option>)}</select><FieldError message={fieldErrors.resourceId} /></label>
                        <InputField label="Number of guests" name="numGuests" type="number" min="1" value={form.numGuests} onChange={updateForm} error={fieldErrors.numGuests} />
                        {form.type === 'venue' ? <>
                            {selectedResource?.bookingMode === 'packaged' ? <label className="text-xs font-semibold text-slate-600">Start time<select name="startTime" value={form.startTime} onChange={updateForm} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-sky-500"><option value="">Choose an hour</option>{hourlyStartTimes(selectedResource).map((time) => <option key={time} value={time}>{new Date(`2000-01-01T${time}`).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</option>)}</select><FieldError message={fieldErrors.startTime} /></label> : <InputField label="Start time" name="startTime" type="time" value={form.startTime} onChange={updateForm} error={fieldErrors.startTime} />}
                            {selectedResource?.bookingMode === 'packaged' || venuePackages.length ? <label className="text-xs font-semibold text-slate-600">Package<select name="packageId" value={form.packageId} onChange={updateForm} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-sky-500"><option value="">Select a package</option>{venuePackages.map((item) => <option key={item.package_id} value={item.package_id}>{item.package_name} · {formatPrice(item.price)}{item.pricing_type === 'per_person' ? ' / person' : ''}</option>)}</select><FieldError message={fieldErrors.packageId} /></label> : null}
                            {selectedResource?.bookingMode === 'packaged' || venuePackages.length ? <InputField label="Extra hours" name="extraHours" type="number" min="0" step="1" value={form.extraHours} onChange={updateForm} /> : null}
                            <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">Calculated venue total: <strong className="text-slate-800">{formatPrice(total)}</strong></div>
                        </> : null}
                    </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="mb-4 text-lg font-semibold text-slate-800">Guest details</h2>
                    <div className="grid gap-4 sm:grid-cols-2"><InputField label="First name" name="firstName" value={form.firstName} onChange={updateForm} error={fieldErrors.firstName} /><InputField label="Last name" name="lastName" value={form.lastName} onChange={updateForm} error={fieldErrors.lastName} /><InputField label="Phone number" name="phone" type="tel" value={form.phone} onChange={updateForm} error={fieldErrors.phone} /><InputField label="Email (optional)" name="email" type="email" value={form.email} onChange={updateForm} /></div>
                    <label className="mt-4 block text-xs font-semibold text-slate-600">Notes (optional)<textarea name="notes" value={form.notes} onChange={updateForm} maxLength="1000" className="mt-1 min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-sky-500" /></label>
                </section>

            </div>

            <div className="h-fit space-y-5 lg:sticky lg:top-6">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="mb-4 text-lg font-semibold text-slate-800">Payment</h2>
                    <div><label className="text-xs font-semibold text-slate-600">Payment method<select name="paymentMethodId" value={form.paymentMethodId} onChange={updateForm} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-sky-500"><option value="">Select a payment method</option>{paymentMethods.map((method) => <option key={method.payment_method_id} value={method.payment_method_id}>{method.method_name}</option>)}</select><FieldError message={fieldErrors.paymentMethodId} /></label>{isCash ? <InputField label="Amount received (optional)" name="amountReceived" type="number" min={total} step="0.01" value={form.amountReceived} onChange={updateForm} /> : null}{isCash && amountReceived >= total ? <p className="mt-2 text-xs text-slate-500">Change: {formatPrice(amountReceived - total)}</p> : null}{needsReceipt ? <><ReceiptCapture file={receiptFile} onFileChange={setReceiptFile} /><FieldError message={fieldErrors.receipt} /></> : null}<p className="mt-2 text-xs text-slate-500">Amount to record: {formatPrice(total)}</p></div>
                </section>
                <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800"><FaCalendarCheck className="text-sky-600" />Summary</h2>
                <dl className="mt-5 space-y-3 text-sm"><div className="flex justify-between gap-3"><dt className="text-slate-500">Unit</dt><dd className="text-right font-medium text-slate-800">{selectedResource?.name || 'Not selected'}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">Dates</dt><dd className="text-right font-medium text-slate-800">{form.type === 'room' ? (form.checkIn && form.checkOut ? `${form.checkIn} - ${form.checkOut}` : 'Not selected') : (form.eventDate || 'Not selected')}</dd></div>{form.type === 'room' ? <div className="flex justify-between gap-3"><dt className="text-slate-500">Nights</dt><dd className="font-medium text-slate-800">{nights || 0}</dd></div> : null}<div className="flex justify-between gap-3 border-t border-slate-200 pt-3"><dt className="font-semibold text-slate-700">Total</dt><dd className="font-bold text-sky-700">{selectedResource || form.type === 'venue' ? formatPrice(total) : 'N/A'}</dd></div></dl>
                <button type="submit" disabled={isSubmitting} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60">{isSubmitting ? 'Creating booking...' : 'Create walk-in booking'}</button>
                </aside>
            </div>
        </form>
    </div>
}
