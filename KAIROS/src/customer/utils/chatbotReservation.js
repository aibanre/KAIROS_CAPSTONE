const PENDING_PROPOSAL_PREFIX = "kairos_chatbot_reservation_proposal_";

export function isReservationConfirmation(value) {
  return /^(?:yes(?:,? please)?|confirm|confirmed|i confirm|i confirm the booking|book it|proceed|go ahead|please proceed)[.! ]*$/i
    .test(String(value || "").trim());
}

export function getPendingChatbotProposal(customerId) {
  if (!customerId) return null;
  try {
    const proposal = JSON.parse(sessionStorage.getItem(`${PENDING_PROPOSAL_PREFIX}${customerId}`) || "null");
    if (proposal?.details && proposal?.summary && ["room", "venue"].includes(proposal.kind)) return proposal;
  } catch {
    sessionStorage.removeItem(`${PENDING_PROPOSAL_PREFIX}${customerId}`);
  }
  return null;
}

export function savePendingChatbotProposal(customerId, proposal) {
  if (!customerId || !proposal) return;
  sessionStorage.setItem(`${PENDING_PROPOSAL_PREFIX}${customerId}`, JSON.stringify(proposal));
}

export function clearPendingChatbotProposal(customerId) {
  if (customerId) sessionStorage.removeItem(`${PENDING_PROPOSAL_PREFIX}${customerId}`);
}
