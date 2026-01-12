import { apiFetch } from "./api";

export const ChatAPI = {
  listChats: (projectid) => apiFetch(`/projects/${projectid}/chats`),
  createChat: (projectid, payload) =>
    apiFetch(`/projects/${projectid}/chats`, {
      method: "POST",
      body: JSON.stringify(payload || {}),
    }),
  getChat: (chatid) => apiFetch(`/chats/${chatid}`),
  sendMessage: (chatid, payload) =>
    apiFetch(`/chats/${chatid}/messages`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  renameChat: (chatid, title) =>
    apiFetch(`/chats/${chatid}`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    }),
  deleteChat: (chatid) =>
    apiFetch(`/chats/${chatid}`, { method: "DELETE" }),
};
