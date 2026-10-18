import { API_URL } from "../../config/api.js";

let visitorBootstrap;

export function ensureReservationVisitor() {
  if (!visitorBootstrap) {
    visitorBootstrap = fetch(`${API_URL}/api/reservations/visitor`, {
      credentials: "include",
      cache: "no-store",
    }).then((response) => {
      if (!response.ok) throw new Error("Could not initialize booking protection.");
    }).catch((error) => {
      visitorBootstrap = null;
      throw error;
    });
  }
  return visitorBootstrap;
}
