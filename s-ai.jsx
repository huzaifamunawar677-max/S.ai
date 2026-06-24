import { useState, useRef, useEffect } from "react";

const SYS = `You are S.AI, a powerful assistant built by Sheikh Digital. Help with anything — writing, assignments, research, questions, analysis.
- Never mention Claude, Anthropic, ChatGPT, OpenAI or any other AI
- If asked who made you: "I'm S.AI, built by Sheikh Digital"
- Assignments/essays must sound fully human
- Reply in the same language the user writes in`;

/* ── FONTS ── */
const FontLink = () => (
  <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');`}</style>
);

/* ── LOGO SVG ── */
const Logo = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 34 34" fill="none">
    <defs>
      <linearGradient id="lg" x1="0" y1="0" x2="34" y2="34" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#F0C040"/>
        <stop offset="100%" stopColor="#9A6F00"/>
      </linearGradient>
    </defs>
    <rect width="34" height="34" rx="9" fill="#111"/>
    <rect x="0.75" y="0.75" width="32.5" height="32.5" rx="8.25" stroke="url(#lg)" strokeWidth="1.5" fill="none"/>
    <text x="50%" y="52%" dominantBaseline="middle" textAnchor="middle"
      fill="url(#lg)" fontSize="19" fontWeight="900"
      fontFamily="Georgia, serif">S</text>
  </svg>
);

const LogoXL = () => (
  <svg width="68" height="68" viewBox="0 0 68 68" fill="none">
    <defs>
      <linearGradient id="lgxl" x1="0" y1="0" x2="68" y2="68" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#F0C040"/>
        <stop offset="100%" stopColor="#9A6F00"/>
      </linearGradient>
    </defs>
    <rect width="68" height="68" rx="18" fill="#111"/>
    <rect x="1.5" y="1.5" width="65" height="65" rx="17" stroke="url(#lgxl)" strokeWidth="2" fill="none"/>
    <text x="50%" y="52%" dominantBaseline="middle" textAnchor="middle"
      fill="url(#lgxl)" fontSize="38" fontWeight="900"
      fontFamily="Georgia, serif">S</text>
  </svg>
);

/* ── HELPERS ── */
const timeLabel = (ts) => {
  const d = new Date(ts), now = new Date();
  const diff = Math.floor((now - d) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-GB", { day:"numeric", month:"short" });
};

const msgTime = (ts) =>
  new Date(ts).toLocaleTimeString("en-US", { hour:"numeric", minute:"2-digit", hour12:true });

const fmt = (t) => {
  if (!t) return "";
  t = t.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#E8B84B">$1</strong>');
  t = t.replace(/```[\w]*\n?([\s\S]*?)```/g,
    '<pre style="background:#161616;border:1px solid #222;padding:14px 16px;border-radius:10px;overflow-x:auto;font-size:13px;margin:10px 0;white-space:pre-wrap;color:#ccc;line-height:1.65;font-family:monospace">$1</pre>');
  t = t.replace(/`([^`]+)`/g,
    '<code style="background:#1e1e1e;padding:2px 7px;border-radius:5px;font-size:13px;color:#E8B84B;font-family:monospace">$1</code>');
  t = t.replace(/\n/g, '<br/>');
  return t;
};

const groupByDate = (chats) => {
  const groups = {};
  chats.forEach(c => {
    const label = timeLabel(c.id);
    if (!groups[label]) groups[label] = [];
    groups[label].push(c);
  });
  return groups;
};

/* ── MAIN ── */
export default function SAI() {
  const [messages, setMessages]         = useState([]);
  const [input, setInput]               = useState("");
  const [loading, setLoading]           = useState(false);
  const [chats, setChats]               = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [sidebar, setSidebar]           = useState(true);
  const [copied, setCopied]             = useState(null);
  const [progress, setProgress]         = useState(0);
  const [speaking, setSpeaking]         = useState(false);
  const [listening, setListening]       = useState(false);

  // auth
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [user, setUser]         = useState(null);
  const [users, setUsers]       = useState({});
  const [aEmail, setAEmail]     = useState("");
  const [aPass, setAPass]       = useState("");
  const [aName, setAName]       = useState("");
  const [aErr, setAErr]         = useState("");

  const bottomRef   = useRef(null);
  const textareaRef = useRef(null);
  const fileRef     = useRef(null);
  const progRef     = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  /* progress bar */
  const startProgress = () => {
    setProgress(10);
    progRef.current = setInterval(() => setProgress(p => p < 85 ? p + 5 : p), 200);
  };
  const endProgress = () => {
    clearInterval(progRef.current);
    setProgress(100);
    setTimeout(() => setProgress(0), 400);
  };

  /* auth */
  const doLogin = () => {
    setAErr("");
    if (!aEmail || !aPass) { setAErr("Please fill all fields."); return; }
    if (users[aEmail]?.password === aPass) {
      setUser({ email: aEmail, name: users[aEmail].name });
      setAuthOpen(false); setAEmail(""); setAPass("");
    } else setAErr("Incorrect email or password.");
  };
  const doSignup = () => {
    setAErr("");
    if (!aName || !aEmail || !aPass) { setAErr("Please fill all fields."); return; }
    if (aPass.length < 6) { setAErr("Password must be at least 6 characters."); return; }
    if (users[aEmail]) { setAErr("This email is already registered."); return; }
    setUsers(p => ({ ...p, [aEmail]: { password: aPass, name: aName } }));
    setUser({ email: aEmail, name: aName });
    setAuthOpen(false); setAEmail(""); setAPass(""); setAName("");
  };
  const logout = () => setUser(null);

  /* send */
  const send = async (override, imageB64) => {
    const txt = override ?? input.trim();
    if (!txt && !imageB64) return;
    if (loading) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "24px";

    const ts = Date.now();
    const userContent = imageB64
      ? [{ type: "image", source: { type: "base64", media_type: "image/jpeg", data: imageB64 } }, { type: "text", text: txt || "Describe this image." }]
      : txt;

    const newMsgs = [...messages, { role: "user", content: userContent, displayText: txt || "📷 Image", ts }];
    setMessages(newMsgs);
    setLoading(true);
    startProgress();

    let cid = activeChatId;
    if (!cid) {
      cid = ts;
      setActiveChatId(cid);
      setChats(p => [{ id: cid, title: (txt || "Image").slice(0, 36) + ((txt?.length > 36) ? "…" : ""), messages: newMsgs }, ...p]);
    }

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, system: SYS, messages: newMsgs.map(m => ({ role: m.role, content: m.content })) }),
      });
      const data = await res.json();
      const reply = data.content?.[0]?.text || "Something went wrong.";
      const updated = [...newMsgs, { role: "assistant", content: reply, displayText: reply, ts: Date.now() }];
      setMessages(updated);
      setChats(p => p.map(c => c.id === cid ? { ...c, messages: updated } : c));
    } catch {
      setMessages(p => [...p, { role: "assistant", content: "Connection lost. Please retry.", displayText: "Connection lost. Please retry.", ts: Date.now() }]);
    }
    setLoading(false);
    endProgress();
  };

  /* voice input */
  const startVoice = () => {
    if (!user) { setAuthOpen(true); setAuthMode("login"); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.lang = "ur-PK";
    r.onstart = () => setListening(true);
    r.onend   = () => setListening(false);
    r.onresult = e => setInput(e.results[0][0].transcript);
    r.start();
  };

  /* voice output */
  const speak = (text) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text.replace(/<[^>]+>/g, "").slice(0, 500));
    utt.lang = "en-US";
    utt.onstart = () => setSpeaking(true);
    utt.onend   = () => setSpeaking(false);
    window.speechSynthesis.speak(utt);
  };

  /* image upload */
  const onImage = e => {
    const file = e.target.files[0];
    if (!file) return;
    if (!user) { setAuthOpen(true); setAuthMode("login"); return; }
    const reader = new FileReader();
    reader.onload = () => send(input || "", reader.result.split(",")[1]);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleKey = e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };
  const newChat   = () => { setMessages([]); setActiveChatId(null); };
  const copy      = (text, i) => { navigator.clipboard.writeText(text); setCopied(i); setTimeout(() => setCopied(null), 2000); };

  const gold = "linear-gradient(135deg,#F0C040,#9A6F00)";
  const grouped = groupByDate(chats);

  /* ── INPUT FIELD STYLE ── */
  const authInput = {
    width: "100%", padding: "11px 14px", borderRadius: "10px",
    border: "1px solid #252525", background: "#141414",
    color: "#fff", fontSize: "15px", outline: "none",
    fontFamily: "Inter, sans-serif", boxSizing: "border-box",
    transition: "border-color 0.2s",
  };

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#0a0a0a", fontFamily: "Inter, sans-serif", color: "#e8e8e8", overflow: "hidden", position: "relative" }}>
      <FontLink />

      {/* ── PROGRESS BAR ── */}
      {progress > 0 && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: "2px", zIndex: 9999, background: "#1a1a1a" }}>
          <div style={{ height: "100%", width: `${progress}%`, background: gold, transition: "width 0.2s ease", borderRadius: "2px" }}/>
        </div>
      )}

      {/* ── AUTH MODAL ── */}
      {authOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "#111", border: "1px solid #1f1f1f", borderRadius: "20px", padding: "36px 30px", width: "100%", maxWidth: "360px", boxShadow: "0 24px 80px rgba(0,0,0,0.7)" }}>
            <div style={{ textAlign: "center", marginBottom: "30px" }}>
              <LogoXL />
              <div style={{ marginTop: "16px", fontSize: "11px", letterSpacing: "3px", color: "#555", fontWeight: "600" }}>S.AI</div>
              <h2 style={{ margin: "8px 0 4px", fontSize: "20px", fontWeight: "800", color: "#fff" }}>
                {authMode === "login" ? "Welcome back" : "Get started"}
              </h2>
              <p style={{ margin: 0, fontSize: "13px", color: "#444" }}>by Sheikh Digital</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {authMode === "signup" && (
                <input value={aName} onChange={e => setAName(e.target.value)} placeholder="Full name" style={authInput}
                  onFocus={e => e.target.style.borderColor = "#9A6F00"}
                  onBlur={e => e.target.style.borderColor = "#252525"} />
              )}
              <input value={aEmail} onChange={e => setAEmail(e.target.value)} placeholder="Email address" type="email" style={authInput}
                onFocus={e => e.target.style.borderColor = "#9A6F00"}
                onBlur={e => e.target.style.borderColor = "#252525"} />
              <input value={aPass} onChange={e => setAPass(e.target.value)} placeholder="Password" type="password" style={authInput}
                onFocus={e => e.target.style.borderColor = "#9A6F00"}
                onBlur={e => e.target.style.borderColor = "#252525"}
                onKeyDown={e => e.key === "Enter" && (authMode === "login" ? doLogin() : doSignup())} />
              {aErr && <p style={{ color: "#f87171", fontSize: "13px", margin: "2px 0 0" }}>{aErr}</p>}
              <button onClick={authMode === "login" ? doLogin : doSignup}
                style={{ marginTop: "4px", padding: "12px", borderRadius: "10px", border: "none", background: gold, color: "#0d0d0d", fontSize: "15px", fontWeight: "700", cursor: "pointer", fontFamily: "Inter, sans-serif", letterSpacing: "0.2px" }}>
                {authMode === "login" ? "Sign in" : "Create account"}
              </button>
              <button onClick={() => setAuthOpen(false)}
                style={{ padding: "10px", borderRadius: "10px", border: "1px solid #1f1f1f", background: "transparent", color: "#555", fontSize: "14px", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
                Cancel
              </button>
            </div>
            <p style={{ textAlign: "center", fontSize: "13px", color: "#3a3a3a", marginTop: "18px" }}>
              {authMode === "login" ? "New here? " : "Already have an account? "}
              <span onClick={() => { setAuthMode(authMode === "login" ? "signup" : "login"); setAErr(""); }}
                style={{ color: "#C8960C", cursor: "pointer", fontWeight: "600" }}>
                {authMode === "login" ? "Create account" : "Sign in"}
              </span>
            </p>
          </div>
        </div>
      )}

      {/* ── LAYOUT ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ── SIDEBAR ── */}
        {sidebar && (
          <div style={{ width: "258px", background: "#0d0d0d", borderRight: "1px solid #161616", display: "flex", flexDirection: "column", flexShrink: 0 }}>
            <div style={{ padding: "16px 14px 12px", borderBottom: "1px solid #161616" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
                <Logo size={32} />
                <div>
                  <div style={{ fontWeight: "900", fontSize: "16px", background: gold, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "-0.2px" }}>S.AI</div>
                  <div style={{ fontSize: "10px", color: "#333", letterSpacing: "0.8px", fontWeight: "500" }}>by Sheikh Digital</div>
                </div>
              </div>
              <button onClick={newChat}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #1e1e1e", background: "transparent", color: "#888", fontSize: "13px", cursor: "pointer", textAlign: "left", fontFamily: "Inter, sans-serif", display: "flex", alignItems: "center", gap: "8px", fontWeight: "500", transition: "all 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "#161616"; e.currentTarget.style.borderColor = "#C8960C44"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "#1e1e1e"; }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="#666" strokeWidth="1.5" strokeLinecap="round"/></svg>
                New chat
              </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "10px 8px" }}>
              {Object.keys(grouped).length === 0
                ? <p style={{ fontSize: "12px", color: "#2a2a2a", padding: "8px", margin: 0 }}>No conversations yet</p>
                : Object.entries(grouped).map(([label, items]) => (
                  <div key={label}>
                    <div style={{ fontSize: "11px", color: "#333", fontWeight: "600", letterSpacing: "0.5px", padding: "8px 10px 4px", textTransform: "uppercase" }}>{label}</div>
                    {items.map(c => (
                      <button key={c.id}
                        onClick={() => { setMessages(c.messages); setActiveChatId(c.id); }}
                        style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "none", background: activeChatId === c.id ? "#161616" : "transparent", color: activeChatId === c.id ? "#ddd" : "#666", fontSize: "13px", cursor: "pointer", textAlign: "left", fontFamily: "Inter, sans-serif", marginBottom: "1px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", transition: "all 0.12s", fontWeight: activeChatId === c.id ? "500" : "400" }}
                        onMouseEnter={e => { if (activeChatId !== c.id) e.currentTarget.style.background = "#131313"; }}
                        onMouseLeave={e => { if (activeChatId !== c.id) e.currentTarget.style.background = "transparent"; }}>
                        {c.title}
                      </button>
                    ))}
                  </div>
                ))
              }
            </div>

            <div style={{ padding: "12px 14px", borderTop: "1px solid #161616" }}>
              {user
                ? <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: gold, display: "flex", alignItems: "center", justifyContent: "center", color: "#0d0d0d", fontSize: "12px", fontWeight: "800" }}>
                      {user.name[0].toUpperCase()}
                    </div>
                    <span style={{ fontSize: "13px", color: "#888", fontWeight: "500", maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</span>
                  </div>
                  <button onClick={logout} title="Sign out"
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#333", fontSize: "15px", padding: "4px", transition: "color 0.15s" }}
                    onMouseEnter={e => e.target.style.color = "#C8960C"}
                    onMouseLeave={e => e.target.style.color = "#333"}>
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M6 2H2.5A1.5 1.5 0 001 3.5v8A1.5 1.5 0 002.5 13H6M10 10l3-2.5L10 5M13 7.5H5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                </div>
                : <button onClick={() => { setAuthOpen(true); setAuthMode("login"); }}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #C8960C33", background: "transparent", color: "#C8960C", fontSize: "13px", cursor: "pointer", fontFamily: "Inter, sans-serif", fontWeight: "600", transition: "all 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#C8960C11"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  Sign in
                </button>
              }
            </div>
          </div>
        )}

        {/* ── MAIN PANEL ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* topbar */}
          <div style={{ padding: "10px 18px", borderBottom: "1px solid #141414", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <button onClick={() => setSidebar(!sidebar)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#333", padding: "4px", display: "flex", alignItems: "center", transition: "color 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.color = "#C8960C"}
                onMouseLeave={e => e.currentTarget.style.color = "#333"}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
              <span style={{ fontWeight: "800", fontSize: "15px", background: gold, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>S.AI</span>
              {speaking && (
                <span style={{ fontSize: "11px", color: "#C8960C", background: "#1a1200", border: "1px solid #C8960C33", borderRadius: "20px", padding: "2px 10px", fontWeight: "500" }}>Speaking</span>
              )}
            </div>
            {!user && (
              <button onClick={() => { setAuthOpen(true); setAuthMode("login"); }}
                style={{ padding: "6px 16px", borderRadius: "8px", border: "1px solid #C8960C44", background: "transparent", color: "#C8960C", fontSize: "13px", cursor: "pointer", fontFamily: "Inter, sans-serif", fontWeight: "600", transition: "all 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.background = "#C8960C11"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                Sign in
              </button>
            )}
          </div>

          {/* messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "32px 20px 8px" }}>
            <div style={{ maxWidth: "720px", margin: "0 auto" }}>

              {messages.length === 0 && (
                <div style={{ textAlign: "center", paddingTop: "72px" }}>
                  <LogoXL />
                  <div style={{ marginTop: "18px" }}>
                    <div style={{ fontSize: "11px", letterSpacing: "3.5px", color: "#333", fontWeight: "600", marginBottom: "6px" }}>S.AI</div>
                    <div style={{ fontSize: "24px", fontWeight: "800", color: "#fff", letterSpacing: "-0.5px" }}>What can I do for you?</div>
                    <div style={{ fontSize: "13px", color: "#333", marginTop: "8px", fontWeight: "400" }}>by Sheikh Digital</div>
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i} style={{ marginBottom: "26px", display: "flex", gap: "13px", alignItems: "flex-start" }}>
                  <div style={{ flexShrink: 0, marginTop: "1px" }}>
                    {msg.role === "assistant"
                      ? <Logo size={28} />
                      : <div style={{ width: "28px", height: "28px", borderRadius: "7px", background: "#1a1a1a", border: "1px solid #242424", display: "flex", alignItems: "center", justifyContent: "center", color: "#888", fontSize: "12px", fontWeight: "700" }}>
                        {user?.name?.[0]?.toUpperCase() || "U"}
                      </div>
                    }
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "7px" }}>
                      <span style={{ fontSize: "13px", fontWeight: "700", color: msg.role === "assistant" ? "#C8960C" : "#555" }}>
                        {msg.role === "assistant" ? "S.AI" : (user?.name || "You")}
                      </span>
                      {msg.ts && <span style={{ fontSize: "11px", color: "#2e2e2e" }}>{msgTime(msg.ts)}</span>}
                    </div>
                    <div style={{ fontSize: "15px", lineHeight: "1.8", color: "#ccc" }}
                      dangerouslySetInnerHTML={{ __html: fmt(msg.displayText || msg.content) }} />
                    {msg.role === "assistant" && (
                      <div style={{ display: "flex", gap: "14px", marginTop: "10px" }}>
                        <button onClick={() => copy(msg.displayText || msg.content, i)}
                          style={{ background: "none", border: "none", fontSize: "12px", color: copied === i ? "#C8960C" : "#2e2e2e", cursor: "pointer", padding: 0, fontWeight: "600", fontFamily: "Inter, sans-serif", transition: "color 0.15s" }}
                          onMouseEnter={e => e.target.style.color = "#C8960C"}
                          onMouseLeave={e => { if (copied !== i) e.target.style.color = "#2e2e2e"; }}>
                          {copied === i ? "Copied" : "Copy"}
                        </button>
                        <button onClick={() => speak(msg.displayText || "")}
                          style={{ background: "none", border: "none", fontSize: "12px", color: "#2e2e2e", cursor: "pointer", padding: 0, fontWeight: "600", fontFamily: "Inter, sans-serif", transition: "color 0.15s" }}
                          onMouseEnter={e => e.target.style.color = "#C8960C"}
                          onMouseLeave={e => e.target.style.color = "#2e2e2e"}>
                          Listen
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div style={{ marginBottom: "26px", display: "flex", gap: "13px", alignItems: "flex-start" }}>
                  <Logo size={28} />
                  <div style={{ paddingTop: "8px", display: "flex", gap: "5px", alignItems: "center" }}>
                    {[0, 1, 2].map(j => (
                      <div key={j} style={{ width: "7px", height: "7px", borderRadius: "50%", background: "linear-gradient(135deg,#F0C040,#9A6F00)", animation: `sai-b 1.3s ease-in-out ${j * 0.18}s infinite` }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          {/* input */}
          <div style={{ padding: "10px 20px 18px", flexShrink: 0 }}>
            <div style={{ maxWidth: "720px", margin: "0 auto" }}>
              <div style={{ border: "1px solid #1c1c1c", borderRadius: "14px", background: "#111", boxShadow: "0 2px 24px rgba(0,0,0,0.5)", transition: "border-color 0.2s" }}
                onFocus={() => {}} >
                <div style={{ display: "flex", alignItems: "flex-end", padding: "10px 12px", gap: "8px" }}>
                  <button onClick={() => fileRef.current?.click()}
                    style={{ width: "32px", height: "32px", borderRadius: "7px", border: "1px solid #1e1e1e", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#444", transition: "all 0.15s" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "#C8960C55"; e.currentTarget.style.color = "#C8960C"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "#1e1e1e"; e.currentTarget.style.color = "#444"; }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 10L4.5 6l2.5 3 2-2.5L13 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/><circle cx="4" cy="4" r="1.2" fill="currentColor"/><rect x="0.7" y="0.7" width="12.6" height="12.6" rx="2.3" stroke="currentColor" strokeWidth="1.3"/></svg>
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onImage} />

                  <textarea ref={textareaRef} value={input}
                    onChange={e => { setInput(e.target.value); e.target.style.height = "24px"; e.target.style.height = Math.min(e.target.scrollHeight, 150) + "px"; }}
                    onKeyDown={handleKey}
                    placeholder="Message S.AI"
                    style={{ flex: 1, border: "none", outline: "none", fontSize: "15px", lineHeight: "1.6", resize: "none", background: "transparent", fontFamily: "Inter, sans-serif", color: "#e8e8e8", height: "24px", maxHeight: "150px", overflowY: "auto", padding: "4px 0" }} />

                  <button onClick={startVoice}
                    style={{ width: "32px", height: "32px", borderRadius: "7px", border: `1px solid ${listening ? "#C8960C" : "#1e1e1e"}`, background: listening ? "#1c1200" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: listening ? "#C8960C" : "#444", transition: "all 0.15s" }}
                    onMouseEnter={e => { if (!listening) { e.currentTarget.style.borderColor = "#C8960C55"; e.currentTarget.style.color = "#C8960C"; } }}
                    onMouseLeave={e => { if (!listening) { e.currentTarget.style.borderColor = "#1e1e1e"; e.currentTarget.style.color = "#444"; } }}>
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="4" y="0.5" width="5" height="7.5" rx="2.5" stroke="currentColor" strokeWidth="1.3"/><path d="M1.5 6.5A5 5 0 006.5 11.5a5 5 0 005-5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><line x1="6.5" y1="11.5" x2="6.5" y2="13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
                  </button>

                  <button onClick={() => send()} disabled={!input.trim() || loading}
                    style={{ width: "34px", height: "34px", borderRadius: "8px", border: "none", background: input.trim() && !loading ? gold : "#181818", color: input.trim() && !loading ? "#0a0a0a" : "#2a2a2a", cursor: input.trim() && !loading ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}>
                    {loading
                      ? <div style={{ width: "13px", height: "13px", border: "2px solid #2a2a2a", borderTopColor: "#9A6F00", borderRadius: "50%", animation: "sai-s 0.7s linear infinite" }} />
                      : <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 12V2M2 7l5-5 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    }
                  </button>
                </div>
              </div>
              <p style={{ textAlign: "center", fontSize: "11px", color: "#1e1e1e", margin: "7px 0 0", fontWeight: "400" }}>S.AI by Sheikh Digital</p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes sai-b { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }
        @keyframes sai-s { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        * { box-sizing:border-box; }
        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:#1c1c1c; border-radius:4px; }
        textarea::placeholder, input::placeholder { color:#2e2e2e; }
      `}</style>
    </div>
  );
}
