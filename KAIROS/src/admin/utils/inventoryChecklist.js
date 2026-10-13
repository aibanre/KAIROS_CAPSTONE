export const DEFAULT_INVENTORY_ITEMS = [
    { id: 'bed-linens', label: 'Bed linens and pillows' },
    { id: 'towels', label: 'Towels and bath supplies' },
    { id: 'television', label: 'Television and remote' },
    { id: 'air-conditioning', label: 'Air-conditioning' },
    { id: 'lights', label: 'Lights and switches' },
    { id: 'bathroom', label: 'Bathroom fixtures' },
    { id: 'furniture', label: 'Furniture and room fixtures' },
]

export function mapInventoryChecklist(value) {
    if (!value) return null
    let input = value
    if (typeof input === 'string') {
        try { input = JSON.parse(input) } catch { return null }
    }
    const source = input.checklist || input.inventory_checklist || input
    const sourceItems = Array.isArray(source.items) ? source.items : []
    return {
        ...source,
        items: sourceItems.map((item, index) => ({
            id: item.id || item.item_id || `item-${index}`,
            label: item.label || item.name || 'Room item',
            status: item.status || (item.present === false ? 'missing' : 'good'),
            notes: item.notes || '',
        })),
        signature: source.signature || source.signature_data || source.guest_signature || '',
        signedAt: source.signedAt || source.signed_at || null,
        signedBy: source.signedBy || source.signed_by || '',
    }
}

export function createInventoryChecklist(items = DEFAULT_INVENTORY_ITEMS) {
    return { items: items.map((item) => ({ ...item, status: 'good', notes: '' })), signature: '', signedAt: null, signedBy: '' }
}

export function mapInventoryInspection(value) {
    if (!value) return null
    let input = value
    if (typeof input === 'string') {
        try { input = JSON.parse(input) } catch { return null }
    }
    const source = input.inspection || input
    const lines = Array.isArray(source.lines) ? source.lines : []

    return {
        checkId: source.check_id ?? null,
        reservationId: source.reservation_id ?? null,
        guestName: source.guest_name ?? '',
        attendantName: source.attendant_name ?? '',
        signatureUrl: source.signature_url ?? '',
        signedAt: source.signed_at ?? null,
        noDamageInside: Boolean(source.no_damage_inside),
        noCrClogging: Boolean(source.no_cr_clogging),
        notes: source.notes || '',
        totalChargeCents: Number(source.total_charge_cents) || 0,
        chargesCollectedAt: source.charges_collected_at ?? null,
        chargesCollectedBy: source.charges_collected_by ?? null,
        lines: lines.map((line, index) => ({
            lineId: line.line_id ?? `line-${index}`,
            itemId: line.item_id ?? null,
            name: line.item_name ?? 'Room item',
            itemName: line.item_name ?? 'Room item',
            quantity: Number(line.quantity) || 0,
            quantityMissing: Number(line.quantity_missing) || 0,
            unitChargeCents: Number(line.unit_charge_cents) || 0,
            chargeCents: Number(line.charge_cents) || 0,
        })),
    }
}