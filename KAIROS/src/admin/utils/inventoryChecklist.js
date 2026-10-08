export function mapInventoryInspection(value) {
    if (!value) return null
    const inspection = value.inspection || value
    return {
        ...inspection,
        guestName: inspection.guest_name || inspection.guestName || '',
        attendantName: inspection.attendant_name || inspection.attendantName || '',
        signatureUrl: inspection.signature_url || inspection.signatureUrl || '',
        totalChargeCents: Number(inspection.total_charge_cents || 0),
        lines: (inspection.lines || []).map((line) => ({
            itemId: line.item_id,
            name: line.item_name,
            quantity: Number(line.quantity || 0),
            quantityMissing: Number(line.quantity_missing || 0),
            unitChargeCents: Number(line.unit_charge_cents || 0),
            chargeCents: Number(line.charge_cents || 0),
        })),
    }
}
