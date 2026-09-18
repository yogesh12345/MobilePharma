import API from "./api";

const SESSION_KEY = "wppconnect_session";

const sessionId = () => String(localStorage.getItem(SESSION_KEY) || import.meta.env.VITE_WHATSAPP_SESSION_ID || "").trim();

const ensureRegistration = async () => {
  const response = await API.get("/api/whatsapp/registration", { params: { global: "1" } });
  const records = Array.isArray(response.data?.data) ? response.data.data : response.data;
  const record = Array.isArray(records) ? records[0] : records;
  const session = record?.session ?? record?.Session ?? record?.sessionId ?? record?.SessionId;
  if (session) localStorage.setItem(SESSION_KEY, String(session));
};

export const sendMedia = async (to: string, base64: string, filename: string, caption: string) => {
  await ensureRegistration();
  const response = await API.post("/api/whatsapp/send-media", {
    session: sessionId(),
    to,
    filename,
    caption,
    base64: base64.replace(/\s+/g, ""),
  });
  return response.data;
};

export const sendText = async (to: string, message: string) => {
  await ensureRegistration();
  const response = await API.post("/api/whatsapp/send-message", {
    session: sessionId(),
    to,
    message,
  });
  return response.data;
};
