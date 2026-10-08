import { request } from "./client";

export async function sendMessage(message) {
  const data = await request("/api/chatbot/message", {
    method: "POST",
    body: { message },
  });
  return data.message;
}
