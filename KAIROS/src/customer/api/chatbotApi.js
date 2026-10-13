import { request } from "./client";

export async function sendMessage(message) {
  const data = await request("/api/chatbot/message", {
    method: "POST",
    body: { message },
  });
  return data;
}

export async function getHistory() {
  return request("/api/chatbot/history");
}

export async function clearHistory() {
  return request("/api/chatbot/history", { method: "DELETE" });
}
