import { useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import AuthImage from "../components/shared/AuthImage";
import PageHeader from "../components/shared/PageHeader";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";

export default function Chat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  
  const loadMessages = async () => {
    try {
      const res = await api.get("/chat");
      setMessages(res.data.data);
    } catch (error) {
      console.error("Failed to load messages", error);
    } finally {
      if (loading) setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
    const interval = setInterval(() => {
      loadMessages();
    }, 5000); 
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    const messageText = newMessage.trim();
    setNewMessage("");
    setSending(true);
    
    try {
      const res = await api.post("/chat", { message: messageText });
      setMessages((prev) => [...prev, res.data.data]);
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to send message");
      setNewMessage(messageText); 
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Team Chat" subtitle="Internal company communication" icon="fa-regular fa-comments" />
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-page d-flex flex-column" style={{ height: "calc(100vh - 140px)" }}>
      <PageHeader title="Team Chat" subtitle="Internal company communication" icon="fa-regular fa-comments" />
      
      <div className="card border-0 shadow-sm flex-grow-1 d-flex flex-column overflow-hidden mt-2">
        <div className="card-body p-0 d-flex flex-column overflow-hidden bg-light rounded">
          
          <div className="chat-messages flex-grow-1 overflow-auto p-4 d-flex flex-column gap-3">
            {messages.length === 0 ? (
              <div className="text-center text-muted my-auto">
                <i className="fa-regular fa-message fa-3x mb-3 opacity-25"></i>
                <p>No messages yet. Start the conversation!</p>
              </div>
            ) : (
              messages.map((msg, index) => {
                const isMe = msg.sender_id === user.member_id;
                const showAvatar = index === 0 || messages[index - 1].sender_id !== msg.sender_id;
                
                return (
                  <div key={msg.id} className={`d-flex ${isMe ? 'justify-content-end' : 'justify-content-start'}`}>
                    {!isMe && (
                      <div className="me-2" style={{ width: "36px" }}>
                        {showAvatar && (
                          msg.sender_avatar ? (
                            <AuthImage src={msg.sender_avatar} alt="avatar" className="rounded-circle shadow-sm" style={{ width: "36px", height: "36px", objectFit: "cover" }} />
                          ) : (
                            <div className="bg-secondary text-white rounded-circle d-flex align-items-center justify-content-center fw-bold shadow-sm" style={{ width: "36px", height: "36px", fontSize: "0.85rem" }}>
                              {msg.sender_name.charAt(0).toUpperCase()}
                            </div>
                          )
                        )}
                      </div>
                    )}
                    
                    <div className={`chat-bubble ${isMe ? 'bg-primary text-white' : 'bg-white border text-dark'} px-3 py-2 shadow-sm`} style={{ maxWidth: "70%", borderRadius: "16px", borderTopRightRadius: isMe ? "4px" : "16px", borderTopLeftRadius: !isMe ? "4px" : "16px" }}>
                      {!isMe && showAvatar && (
                        <div className="fw-semibold small mb-1" style={{ fontSize: "0.75rem", color: "var(--bs-primary)" }}>
                          {msg.sender_name} <span className="badge bg-light text-dark ms-1" style={{ fontSize: "0.6rem" }}>{msg.sender_role}</span>
                        </div>
                      )}
                      <div style={{ wordBreak: "break-word", whiteSpace: "pre-wrap" }}>{msg.message}</div>
                      <div className={`small mt-1 text-end ${isMe ? 'text-white-50' : 'text-muted'}`} style={{ fontSize: "0.65rem" }}>
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="chat-input bg-white border-top p-3 rounded-bottom">
            <form onSubmit={handleSendMessage} className="d-flex gap-2">
              <input
                type="text"
                className="form-control rounded-pill px-4 bg-light"
                placeholder="Type your message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                disabled={sending}
                autoFocus
              />
              <button 
                type="submit" 
                className="btn btn-primary rounded-circle d-flex align-items-center justify-content-center shadow-sm" 
                style={{ width: "42px", height: "42px", flexShrink: 0 }}
                disabled={!newMessage.trim() || sending}
              >
                <i className={`fa-solid ${sending ? 'fa-spinner fa-spin' : 'fa-paper-plane'} ${!sending && 'ms-1'}`}></i>
              </button>
            </form>
          </div>
          
        </div>
      </div>
    </div>
  );
}
