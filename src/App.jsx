import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Home as HomeIcon,
  Package,
  Receipt,
  User,
  Mic,
  Plus,
  Minus,
  Send,
  TrendingUp,
  AlertTriangle,
  X,
  ChevronDown,
  ChevronUp,
  Trash2,
  Pencil,
  Check,
  ShoppingCart,
  Loader2,
  MessageCircle,
} from "lucide-react";

/* ---------------------------------------------------------
   Design tokens
--------------------------------------------------------- */
const C = {
  bg: "#14171C",
  surface: "#1C2129",
  surfaceAlt: "#242A34",
  raised: "#2A303B",
  accent: "#D4A24E",
  accentDim: "#8C6F3B",
  accentSoft: "rgba(212,162,78,0.12)",
  success: "#4A9D6F",
  successSoft: "rgba(74,157,111,0.14)",
  danger: "#E2574C",
  dangerSoft: "rgba(226,87,76,0.14)",
  text: "#EDEFF2",
  muted: "#8A93A3",
  faint: "#5B6472",
  border: "#2C333F",
};

const STORAGE_KEYS = {
  products: "pos_products_v2",
  invoices: "pos_invoices_v2",
  profile: "pos_profile_v2",
  chat: "pos_chat_v2",
};

const UNIT_TYPES = ["pcs", "kg", "g", "L", "ml", "packet", "dozen", "box"];

const DEFAULT_PRODUCTS = [
  { id: "p1", name: "Basmati Rice", price: 120, stock: 24, lowStock: 10, unit: "kg" },
  { id: "p2", name: "Sugar", price: 45, stock: 6, lowStock: 10, unit: "kg" },
  { id: "p3", name: "Wheat Atta", price: 210, stock: 15, lowStock: 5, unit: "kg" },
  { id: "p4", name: "Sunflower Oil", price: 165, stock: 3, lowStock: 8, unit: "L" },
  { id: "p5", name: "Toned Milk", price: 28, stock: 40, lowStock: 15, unit: "packet" },
  { id: "p6", name: "Iodised Salt", price: 22, stock: 30, lowStock: 10, unit: "kg" },
  { id: "p7", name: "Tea Powder", price: 95, stock: 5, lowStock: 6, unit: "packet" },
];

const DEFAULT_PROFILE = {
  businessName: "",
  gst: "",
  address: "",
  phone: "",
  taxRate: "5",
};

/* ---------------------------------------------------------
   Supabase (REST/PostgREST — no SDK bundled in this sandbox,
   so we talk to the auto-generated REST API directly with fetch)
--------------------------------------------------------- */
const SUPABASE_URL = "https://cqthrznhunglsaveobsj.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_IwROgSWF_WxR3zYwTFlXuA_VfPaxl2-";

async function supabaseInsert(table, row) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    mode: "cors",
    headers: {
      "Content-Type": "application/json",
      // Supabase's newer sb_publishable_/sb_secret_ keys are opaque, not JWTs.
      // They go on the apikey header only — also sending them as
      // "Authorization: Bearer <key>" makes the gateway try to parse the
      // value as a JWT and reject the request with "Invalid JWT".
      apikey: SUPABASE_ANON_KEY,
      Prefer: "return=minimal",
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Supabase insert failed (${res.status}): ${detail}`);
  }
}

/* ---------------------------------------------------------
   Helpers
--------------------------------------------------------- */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const money = (n) => `\u20B9${Number(n || 0).toFixed(2)}`;

async function callClaude(userText, { json = false, maxTokens = 1000 } = {}) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: userText }],
    }),
  });
  const data = await res.json();
  const text = (data.content || [])
    .map((b) => (b.type === "text" ? b.text : ""))
    .filter(Boolean)
    .join("\n");
  if (json) {
    const cleaned = text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
  }
  return text;
}

/* ---------------------------------------------------------
   Font + global styles
--------------------------------------------------------- */
function FontStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700;800&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap');
      .f-display { font-family: 'Sora', sans-serif; }
      .f-body { font-family: 'Inter', sans-serif; }
      .f-mono { font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; }
      * { -webkit-tap-highlight-color: transparent; }
      ::-webkit-scrollbar { width: 0px; height: 0px; }
      @keyframes pulseRing {
        0% { box-shadow: 0 0 0 0 rgba(212,162,78,0.45); }
        70% { box-shadow: 0 0 0 14px rgba(212,162,78,0); }
        100% { box-shadow: 0 0 0 0 rgba(212,162,78,0); }
      }
      .mic-pulse { animation: pulseRing 1.6s ease-out infinite; }
      @keyframes slideUp {
        from { transform: translateY(16px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      .sheet-in { animation: slideUp 0.22s ease-out; }
    `}</style>
  );
}

/* ---------------------------------------------------------
   Header (no settings gear — Home is billing-only now)
--------------------------------------------------------- */
function Header({ title, eyebrow }) {
  return (
    <div className="px-5 pt-6 pb-4" style={{ background: C.bg }}>
      <div className="f-mono text-[11px] tracking-widest uppercase" style={{ color: C.accent }}>
        {eyebrow}
      </div>
      <div className="f-display text-2xl font-bold mt-0.5" style={{ color: C.text }}>
        {title}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   Bottom Nav
--------------------------------------------------------- */
function BottomNav({ tab, setTab }) {
  const items = [
    { key: "home", label: "Home", Icon: HomeIcon },
    { key: "inventory", label: "Inventory", Icon: Package },
    { key: "history", label: "Invoices", Icon: Receipt },
    { key: "profile", label: "Profile", Icon: User },
  ];
  return (
    <div
      className="flex-shrink-0 flex justify-around items-center py-2 px-2 z-30"
      style={{
        background: C.surface,
        borderTop: `1px solid ${C.border}`,
      }}
    >
      {items.map(({ key, label, Icon }) => {
        const active = tab === key;
        return (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl transition active:scale-95"
            style={{ background: active ? C.accentSoft : "transparent" }}
          >
            <Icon size={20} color={active ? C.accent : C.faint} strokeWidth={active ? 2.4 : 2} />
            <span className="f-body text-[10px] font-medium" style={{ color: active ? C.accent : C.faint }}>
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------
   Voice-to-Bill Card
--------------------------------------------------------- */
function VoiceToBillCard({ products, onParsed }) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [manualText, setManualText] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const recogRef = useRef(null);
  const supported = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);

  const parseAndApply = useCallback(
    async (text) => {
      if (!text || !text.trim()) return;
      setBusy(true);
      setNote(null);
      try {
        const productList = products.map((p) => `${p.name} (id:${p.id})`).join(", ");
        const prompt = `You are parsing a shopkeeper's spoken or typed billing command into structured line items.
Available products: ${productList}.
Command: "${text}"
Match each mentioned item to the closest available product by name (fuzzy match ok, ignore case/quantity words like "kg" or "packet" unless part of the product name). Return ONLY a JSON array, no prose, no markdown fences, like:
[{"id":"p1","qty":2},{"id":"p3","qty":1}]
If nothing matches, return [].`;
        const items = await callClaude(prompt, { json: true, maxTokens: 300 });
        if (Array.isArray(items) && items.length > 0) {
          onParsed(items);
          setNote({ type: "ok", msg: `Added ${items.length} item${items.length > 1 ? "s" : ""} to the bill.` });
        } else {
          setNote({ type: "warn", msg: "Couldn't match that to any product. Try rephrasing." });
        }
      } catch (e) {
        setNote({ type: "warn", msg: "Couldn't reach the assistant. Try again." });
      } finally {
        setBusy(false);
      }
    },
    [products, onParsed]
  );

  const startListening = () => {
    if (listening || busy) return;
    if (!supported) {
      setNote({ type: "warn", msg: "Voice input isn't supported in this browser. Use text below instead." });
      return;
    }
    try {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recog = new SR();
      recog.lang = "en-IN";
      recog.interimResults = false;
      recog.continuous = false;
      recog.maxAlternatives = 1;
      recog.onstart = () => {
        setListening(true);
        setNote(null);
      };
      recog.onend = () => setListening(false);
      recog.onerror = (e) => {
        setListening(false);
        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          setNote({ type: "warn", msg: "Microphone access was blocked. Allow mic permission for this page, or use the text field below." });
        } else if (e.error === "no-speech") {
          setNote({ type: "warn", msg: "Didn't catch that — tap the mic and try again." });
        } else {
          setNote({ type: "warn", msg: "Voice input failed. Try the text field below." });
        }
      };
      recog.onresult = (e) => {
        const t = e.results[0][0].transcript;
        setTranscript(t);
        parseAndApply(t);
      };
      recogRef.current = recog;
      recog.start();
    } catch (err) {
      setListening(false);
      setNote({ type: "warn", msg: "Couldn't start voice input on this device. Use the text field below." });
    }
  };

  return (
    <div className="mx-5 mt-4 rounded-2xl p-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="f-display text-sm font-semibold" style={{ color: C.text }}>
          Voice-to-Bill
        </div>
        <span className="f-mono text-[10px] px-1.5 py-0.5 rounded" style={{ background: C.accentSoft, color: C.accent }}>
          AI
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={startListening}
          disabled={busy}
          className={`w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0 active:scale-95 transition ${listening ? "mic-pulse" : ""}`}
          style={{ background: listening ? C.accent : C.accentSoft, border: `1px solid ${C.accentDim}`, touchAction: "manipulation" }}
        >
          {busy ? (
            <Loader2 size={24} className="animate-spin" color={listening ? C.bg : C.accent} />
          ) : (
            <Mic size={24} color={listening ? C.bg : C.accent} />
          )}
        </button>
        <div className="flex-1 min-w-0">
          <div className="f-body text-xs" style={{ color: C.muted }}>
            {listening ? "Listening…" : "Tap the mic and say an order"}
          </div>
          {transcript ? (
            <div className="f-body text-sm mt-0.5 truncate" style={{ color: C.text }}>
              "{transcript}"
            </div>
          ) : (
            <div className="f-body text-xs mt-0.5" style={{ color: C.faint }}>
              e.g. "2 sugar, 1 oil, 3 milk"
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3">
        <input
          value={manualText}
          onChange={(e) => setManualText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && manualText.trim()) {
              parseAndApply(manualText);
              setManualText("");
            }
          }}
          placeholder="Or type a command…"
          className="f-body flex-1 text-sm rounded-xl px-3 py-2.5 outline-none"
          style={{ background: C.surfaceAlt, color: C.text, border: `1px solid ${C.border}` }}
        />
        <button
          type="button"
          onClick={() => {
            if (manualText.trim()) {
              parseAndApply(manualText);
              setManualText("");
            }
          }}
          disabled={busy}
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 active:scale-95 transition"
          style={{ background: C.accentSoft }}
        >
          <Send size={16} color={C.accent} />
        </button>
      </div>

      {note && (
        <div
          className="f-body text-xs mt-3 rounded-lg px-3 py-2"
          style={{ background: note.type === "ok" ? C.successSoft : C.dangerSoft, color: note.type === "ok" ? C.success : C.danger }}
        >
          {note.msg}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   Billing List (Home) — pure billing, no edit/delete here
--------------------------------------------------------- */
function BillingList({ products, cart, onAdjust, bottomPad }) {
  const [open, setOpen] = useState(true);

  return (
    <div
      className="mx-5 rounded-2xl overflow-hidden flex flex-col h-full min-h-0"
      style={{ background: C.surface, border: `1px solid ${C.border}` }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 active:opacity-80 flex-shrink-0"
      >
        <div className="f-display text-sm font-semibold" style={{ color: C.text }}>
          Items for billing <span style={{ color: C.faint }}>({products.length})</span>
        </div>
        {open ? <ChevronUp size={18} color={C.muted} /> : <ChevronDown size={18} color={C.muted} />}
      </button>

      {open && (
        <div className="flex-1 min-h-0 overflow-y-auto" style={{ borderTop: `1px solid ${C.border}`, paddingBottom: bottomPad }}>
          {products.map((p) => {
            const qty = cart[p.id] || 0;
            const low = p.stock <= p.lowStock;
            return (
              <div key={p.id} className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${C.border}` }}>
                <div className="min-w-0 pr-2">
                  <div className="f-body text-sm font-medium truncate" style={{ color: C.text }}>
                    {p.name}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="f-mono text-xs" style={{ color: C.muted }}>
                      {money(p.price)} / {p.unit}
                    </span>
                    <span
                      className="f-mono text-[10px] px-1.5 rounded"
                      style={{ color: low ? C.danger : C.faint, background: low ? C.dangerSoft : "transparent" }}
                    >
                      {low && <AlertTriangle size={9} className="inline mr-0.5 -mt-0.5" />}
                      {p.stock} {p.unit} left
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => onAdjust(p.id, -1)}
                    disabled={qty === 0}
                    className="w-7 h-7 rounded-full flex items-center justify-center active:scale-90 transition disabled:opacity-30"
                    style={{ background: C.surfaceAlt, border: `1px solid ${C.border}` }}
                  >
                    <Minus size={13} color={C.text} />
                  </button>
                  <span className="f-mono text-sm w-5 text-center" style={{ color: C.text }}>
                    {qty}
                  </span>
                  <button
                    type="button"
                    onClick={() => onAdjust(p.id, 1)}
                    disabled={p.stock <= qty}
                    className="w-7 h-7 rounded-full flex items-center justify-center active:scale-90 transition disabled:opacity-30"
                    style={{ background: C.accentSoft }}
                  >
                    <Plus size={13} color={C.accent} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   Sticky Checkout Bar — only appears when cart has items
--------------------------------------------------------- */
function CheckoutBar({ count, total, onOpen }) {
  if (count === 0) return null;
  return (
    <div className="flex-shrink-0 px-5 pb-3 pt-1" style={{ background: C.bg }}>
      <button
        type="button"
        onClick={onOpen}
        className="w-full rounded-2xl px-4 py-3.5 flex items-center justify-between active:scale-[0.98] transition sheet-in"
        style={{ background: C.accent, boxShadow: "0 8px 24px rgba(0,0,0,0.35)" }}
      >
        <div className="flex items-center gap-2">
          <ShoppingCart size={16} color={C.bg} />
          <span className="f-body text-sm font-semibold" style={{ color: C.bg }}>
            {count} item{count > 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="f-mono text-sm font-bold" style={{ color: C.bg }}>
            {money(total)}
          </span>
          <span className="f-body text-xs font-semibold" style={{ color: C.bg }}>
            Proceed to checkout →
          </span>
        </div>
      </button>
    </div>
  );
}

/* ---------------------------------------------------------
   Checkout Modal — bill + WhatsApp (exact format) + print
--------------------------------------------------------- */
function CheckoutModal({ open, onClose, cart, products, profile, onConfirm }) {
  const [phoneDigits, setPhoneDigits] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [saved, setSaved] = useState(false);
  const [dbStatus, setDbStatus] = useState("idle"); // idle | saving | synced | error
  const [dbError, setDbError] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [lines, setLines] = useState([]);

  // Snapshot the cart when the modal opens so the bill stays stable even after
  // the sale saves and the live cart is cleared behind the scenes.
  useEffect(() => {
    if (open) {
      const snapshot = Object.entries(cart)
        .filter(([, q]) => q > 0)
        .map(([id, qty]) => {
          const p = products.find((x) => x.id === id);
          return { id, name: p?.name || "—", qty, price: p?.price || 0, unit: p?.unit || "" };
        });
      setLines(snapshot);
      setSaved(false);
      setDbStatus("idle");
      setDbError("");
      setPhoneDigits("");
      setPaymentMethod("Cash");
      setInvoiceNo(`INV-${Date.now().toString().slice(-8)}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const subtotal = lines.reduce((s, l) => s + l.qty * l.price, 0);
  const taxRate = Number(profile.taxRate) || 0;
  const tax = subtotal * (taxRate / 100);
  const grandTotal = subtotal + tax;
  const now = new Date();
  const dateStr = `${now.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })}, ${now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;

  // Exact invoice message format, sent via WhatsApp.
  const invoiceMessage = [
    `\uD83D\uDECD\uFE0F INVOICE: ${profile.businessName || "Your Store"}`,
    `Date: ${dateStr}`,
    `Payment: ${paymentMethod}`,
    "",
    ...lines.map((l) => `\u2022 ${l.name} x ${l.qty} = ${money(l.qty * l.price)}`),
    "",
    `Subtotal: ${money(subtotal)}`,
    `GST (${taxRate}%): ${money(tax)}`,
    `GRAND TOTAL: ${money(grandTotal)}`,
    "",
    "Thank you for shopping with us!",
  ].join("\n");

  const ensureSaved = () => {
    if (!saved) {
      onConfirm(lines, grandTotal);
      setSaved(true);
    }
  };

  const fullPhone = `91${phoneDigits}`;

  const sendWhatsApp = () => {
    if (phoneDigits.length !== 10) return;
    ensureSaved();
    // Open WhatsApp synchronously within the click handler so browsers don't
    // treat it as a blocked popup; the Supabase write happens alongside it.
    window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(invoiceMessage)}`, "_blank");

    setDbStatus("saving");
    supabaseInsert("invoices", {
      customer_phone: `+${fullPhone}`,
      items: lines.map((l) => ({ name: l.name, qty: l.qty, price: l.price, unit: l.unit })),
      total_amount: Number(grandTotal.toFixed(2)),
      payment_method: paymentMethod,
    })
      .then(() => setDbStatus("synced"))
      .catch((err) => {
        setDbStatus("error");
        setDbError(err?.message || "Unknown error");
      });
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.55)" }} onClick={onClose}>
      <div
        className="w-full sheet-in rounded-t-3xl p-5 pb-8 max-h-[88vh] overflow-y-auto"
        style={{ background: C.surface, maxWidth: 480, borderTop: `1px solid ${C.border}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="f-display text-lg font-bold" style={{ color: C.text }}>
            Checkout
          </div>
          <button type="button" onClick={onClose}>
            <X size={20} color={C.muted} />
          </button>
        </div>

        <div className="rounded-xl p-4 mb-4 text-center" style={{ background: C.surfaceAlt, border: `1px solid ${C.border}` }}>
          <div className="f-display text-base font-bold" style={{ color: C.text }}>
            {profile.businessName || "Your Store"}
          </div>
          {profile.address && (
            <div className="f-body text-xs mt-1" style={{ color: C.muted }}>
              {profile.address}
            </div>
          )}
          {profile.gst && (
            <div className="f-mono text-xs mt-1" style={{ color: C.muted }}>
              GSTIN: {profile.gst}
            </div>
          )}
          <div className="flex items-center justify-center gap-2 mt-2 pt-2" style={{ borderTop: `1px dashed ${C.border}` }}>
            <span className="f-mono text-[11px]" style={{ color: C.faint }}>{invoiceNo}</span>
            <span style={{ color: C.faint }}>·</span>
            <span className="f-mono text-[11px]" style={{ color: C.faint }}>{dateStr}</span>
          </div>
        </div>

        <div style={{ borderTop: `1px dashed ${C.border}` }}>
          {lines.map((l) => (
            <div key={l.id} className="flex items-center justify-between py-2.5" style={{ borderBottom: `1px dashed ${C.border}` }}>
              <div className="f-body text-sm" style={{ color: C.text }}>
                {l.name} <span style={{ color: C.faint }}>× {l.qty}</span>
              </div>
              <div className="f-mono text-sm" style={{ color: C.text }}>
                {money(l.qty * l.price)}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="f-body text-xs" style={{ color: C.muted }}>Subtotal</span>
            <span className="f-mono text-xs" style={{ color: C.text }}>{money(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="f-body text-xs" style={{ color: C.muted }}>GST ({taxRate}%)</span>
            <span className="f-mono text-xs" style={{ color: C.text }}>{money(tax)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: `1px solid ${C.border}` }}>
          <span className="f-display text-base font-semibold" style={{ color: C.text }}>
            Grand total
          </span>
          <span className="f-mono text-xl font-bold" style={{ color: C.accent }}>
            {money(grandTotal)}
          </span>
        </div>

        <div className="mt-5">
          <label className="f-body text-[11px]" style={{ color: C.muted }}>
            Customer WhatsApp number
          </label>
          <div className="flex items-center gap-2 mt-1">
            <div
              className="f-mono text-sm rounded-lg px-3 py-2 flex-shrink-0"
              style={{ background: C.raised, color: C.muted, border: `1px solid ${C.border}` }}
            >
              +91
            </div>
            <input
              value={phoneDigits}
              onChange={(e) => setPhoneDigits(e.target.value.replace(/\D/g, "").slice(0, 10))}
              type="tel"
              inputMode="numeric"
              maxLength={10}
              placeholder="10-digit number"
              className="f-mono flex-1 text-sm rounded-lg px-3 py-2 outline-none"
              style={{ background: C.surfaceAlt, color: C.text, border: `1px solid ${C.border}` }}
            />
          </div>
          {phoneDigits.length > 0 && phoneDigits.length < 10 && (
            <div className="f-body text-[11px] mt-1" style={{ color: C.faint }}>
              {10 - phoneDigits.length} more digit{10 - phoneDigits.length > 1 ? "s" : ""} needed
            </div>
          )}
        </div>

        <div className="mt-4">
          <label className="f-body text-[11px]" style={{ color: C.muted }}>
            Payment method
          </label>
          <div className="flex gap-2 mt-1">
            {["Cash", "UPI", "Credit"].map((method) => {
              const active = paymentMethod === method;
              return (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className="flex-1 rounded-lg py-2.5 f-body text-sm font-semibold transition active:scale-[0.97]"
                  style={{
                    background: active ? C.accent : C.surfaceAlt,
                    color: active ? C.bg : C.muted,
                    border: `1px solid ${active ? C.accent : C.border}`,
                  }}
                >
                  {method}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={sendWhatsApp}
          disabled={phoneDigits.length !== 10}
          className="w-full mt-5 rounded-xl py-3.5 f-body text-sm font-semibold active:scale-[0.98] transition disabled:opacity-40 flex items-center justify-center gap-2"
          style={{ background: C.success, color: C.bg }}
        >
          Send Bill via WhatsApp
        </button>

        {saved && (
          <div
            className="w-full mt-3 rounded-xl py-2.5 f-body text-xs font-semibold flex items-center justify-center gap-2"
            style={{ background: C.successSoft, color: C.success }}
          >
            <Check size={14} /> Saved to invoice history
          </div>
        )}

        {dbStatus === "saving" && (
          <div className="w-full mt-2 rounded-xl py-2.5 f-body text-xs font-medium flex items-center justify-center gap-2" style={{ background: C.surfaceAlt, color: C.muted }}>
            <Loader2 size={13} className="animate-spin" /> Syncing to database…
          </div>
        )}
        {dbStatus === "synced" && (
          <div className="w-full mt-2 rounded-xl py-2.5 f-body text-xs font-semibold flex items-center justify-center gap-2" style={{ background: C.successSoft, color: C.success }}>
            <Check size={14} /> Synced to Supabase
          </div>
        )}
        {dbStatus === "error" && (
          <div className="w-full mt-2 rounded-xl px-3 py-2.5" style={{ background: C.dangerSoft }}>
            <div className="f-body text-xs font-semibold flex items-center gap-2" style={{ color: C.danger }}>
              <AlertTriangle size={13} /> Saved locally, but database sync failed
            </div>
            {dbError && (
              <div className="f-mono text-[10px] mt-1.5 break-words" style={{ color: C.danger, opacity: 0.85 }}>
                {dbError}
              </div>
            )}
          </div>
        )}

        <button type="button" onClick={onClose} className="w-full mt-3 rounded-xl py-2.5 f-body text-xs font-medium" style={{ color: C.faint }}>
          Done
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   Product Form Modal (used only inside Inventory tab)
--------------------------------------------------------- */
function ProductFormModal({ open, mode, initial, onClose, onSave, onDelete }) {
  const [form, setForm] = useState({ name: "", price: "", stock: "", lowStock: "5", unit: "pcs" });

  useEffect(() => {
    if (open) {
      setForm(
        initial
          ? { name: initial.name, price: initial.price, stock: initial.stock, lowStock: initial.lowStock, unit: initial.unit || "pcs" }
          : { name: "", price: "", stock: "", lowStock: "5", unit: "pcs" }
      );
    }
  }, [open, initial]);

  if (!open) return null;

  const save = () => {
    if (!form.name.trim()) return;
    onSave({
      name: form.name.trim(),
      price: Number(form.price) || 0,
      stock: Number(form.stock) || 0,
      lowStock: Number(form.lowStock) || 5,
      unit: form.unit || "pcs",
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div
        className="w-full sheet-in rounded-t-3xl p-5 pb-8"
        style={{ background: C.surface, maxWidth: 480, borderTop: `1px solid ${C.border}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="f-display text-lg font-bold" style={{ color: C.text }}>
            {mode === "edit" ? "Edit product" : "Add product"}
          </div>
          <button type="button" onClick={onClose}>
            <X size={20} color={C.muted} />
          </button>
        </div>

        <label className="f-body text-[11px]" style={{ color: C.muted }}>Name</label>
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Product name"
          className="f-body w-full text-sm rounded-lg px-3 py-2 mt-1 mb-3 outline-none"
          style={{ background: C.surfaceAlt, color: C.text, border: `1px solid ${C.border}` }}
        />

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className="f-body text-[11px]" style={{ color: C.muted }}>Price</label>
            <input
              type="number"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              className="f-mono w-full text-sm rounded-lg px-3 py-2 mt-1 outline-none"
              style={{ background: C.surfaceAlt, color: C.text, border: `1px solid ${C.border}` }}
            />
          </div>
          <div>
            <label className="f-body text-[11px]" style={{ color: C.muted }}>Quantity</label>
            <input
              type="number"
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: e.target.value })}
              className="f-mono w-full text-sm rounded-lg px-3 py-2 mt-1 outline-none"
              style={{ background: C.surfaceAlt, color: C.text, border: `1px solid ${C.border}` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <div>
            <label className="f-body text-[11px]" style={{ color: C.muted }}>Unit type</label>
            <select
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              className="f-body w-full text-sm rounded-lg px-3 py-2 mt-1 outline-none"
              style={{ background: C.surfaceAlt, color: C.text, border: `1px solid ${C.border}` }}
            >
              {UNIT_TYPES.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="f-body text-[11px]" style={{ color: C.muted }}>Low stock at</label>
            <input
              type="number"
              value={form.lowStock}
              onChange={(e) => setForm({ ...form, lowStock: e.target.value })}
              className="f-mono w-full text-sm rounded-lg px-3 py-2 mt-1 outline-none"
              style={{ background: C.surfaceAlt, color: C.text, border: `1px solid ${C.border}` }}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={save}
          className="w-full rounded-xl py-3 f-body text-sm font-semibold active:scale-[0.98] transition"
          style={{ background: C.accent, color: C.bg }}
        >
          Save product
        </button>

        {mode === "edit" && (
          <button
            type="button"
            onClick={onDelete}
            className="w-full mt-2 rounded-xl py-3 f-body text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition"
            style={{ background: C.dangerSoft, color: C.danger }}
          >
            <Trash2 size={15} /> Delete product
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   Inventory Tab — the only place for product management
--------------------------------------------------------- */
function InventoryTab({ products, onAdd, onUpdate, onDelete }) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const openNew = () => {
    setEditingId(null);
    setFormOpen(true);
  };
  const openEdit = (id) => {
    setEditingId(id);
    setFormOpen(true);
  };
  const handleSave = (payload) => {
    if (editingId) onUpdate(editingId, payload);
    else onAdd(payload);
    setFormOpen(false);
  };
  const handleDelete = () => {
    if (editingId) onDelete(editingId);
    setFormOpen(false);
  };

  const editingProduct = products.find((p) => p.id === editingId) || null;

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex items-center justify-between px-5 py-3 flex-shrink-0">
        <div className="f-body text-xs" style={{ color: C.muted }}>
          {products.length} product{products.length !== 1 ? "s" : ""}
        </div>
        <button
          type="button"
          onClick={openNew}
          className="w-11 h-11 rounded-full flex items-center justify-center active:scale-95 transition"
          style={{ background: C.accent, boxShadow: "0 4px 14px rgba(212,162,78,0.35)" }}
          aria-label="Add product"
        >
          <Plus size={20} color={C.bg} strokeWidth={2.6} />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-8">
        {products.map((p) => {
          const low = p.stock <= p.lowStock;
          return (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-2xl px-4 py-3.5 mb-2.5"
              style={{ background: low ? C.dangerSoft : C.surface, border: `1px solid ${low ? "rgba(226,87,76,0.35)" : C.border}` }}
            >
              <div className="min-w-0 pr-2">
                <div className="f-body text-sm font-medium truncate" style={{ color: C.text }}>
                  {p.name}
                </div>
                <div className="f-mono text-xs mt-0.5 flex items-center gap-1" style={{ color: low ? C.danger : C.muted }}>
                  {low && <AlertTriangle size={11} />}
                  {money(p.price)}/{p.unit} · {p.stock} {p.unit} in stock
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => openEdit(p.id)}
                  className="w-8 h-8 rounded-full flex items-center justify-center active:scale-90"
                  style={{ background: C.surfaceAlt }}
                  aria-label="Edit"
                >
                  <Pencil size={14} color={C.text} />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(p.id)}
                  className="w-8 h-8 rounded-full flex items-center justify-center active:scale-90"
                  style={{ background: C.dangerSoft }}
                  aria-label="Delete"
                >
                  <Trash2 size={14} color={C.danger} />
                </button>
              </div>
            </div>
          );
        })}
        {products.length === 0 && (
          <div className="text-center pt-10 f-body text-sm" style={{ color: C.faint }}>
            No products yet. Tap + to add your first one.
          </div>
        )}
      </div>

      <ProductFormModal
        open={formOpen}
        mode={editingId ? "edit" : "new"}
        initial={editingProduct}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </div>
  );
}

/* ---------------------------------------------------------
   History Tab
--------------------------------------------------------- */
function HistoryTab({ invoices }) {
  const [openId, setOpenId] = useState(null);
  if (invoices.length === 0) {
    return (
      <div className="px-5 pt-10 text-center">
        <div className="f-body text-sm" style={{ color: C.faint }}>
          No invoices yet. Bills you complete on Home will show up here.
        </div>
      </div>
    );
  }
  return (
    <div className="px-5 pb-8">
      {invoices
        .slice()
        .reverse()
        .map((inv) => {
          const open = openId === inv.id;
          return (
            <div key={inv.id} className="rounded-2xl mb-2.5 overflow-hidden" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
              <button onClick={() => setOpenId(open ? null : inv.id)} className="w-full flex items-center justify-between px-4 py-3.5">
                <div className="text-left">
                  <div className="f-body text-sm font-medium" style={{ color: C.text }}>
                    {new Date(inv.timestamp).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })}
                  </div>
                  <div className="f-mono text-xs mt-0.5" style={{ color: C.muted }}>
                    {new Date(inv.timestamp).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })} · {inv.items.length} item{inv.items.length > 1 ? "s" : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="f-mono text-sm font-bold" style={{ color: C.accent }}>
                    {money(inv.total)}
                  </span>
                  {open ? <ChevronUp size={16} color={C.muted} /> : <ChevronDown size={16} color={C.muted} />}
                </div>
              </button>
              {open && (
                <div className="px-4 pb-4" style={{ borderTop: `1px dashed ${C.border}` }}>
                  {inv.items.map((it, i) => (
                    <div key={i} className="flex items-center justify-between py-2">
                      <span className="f-body text-xs" style={{ color: C.text }}>
                        {it.name} × {it.qty}
                      </span>
                      <span className="f-mono text-xs" style={{ color: C.muted }}>
                        {money(it.qty * it.price)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
}

/* ---------------------------------------------------------
   Profile Tab (details + analytics + AI assistant)
--------------------------------------------------------- */
function ProfileTab({ profile, setProfile, invoices, products }) {
  const [form, setForm] = useState(profile);
  const [saved, setSaved] = useState(false);

  useEffect(() => setForm(profile), [profile]);

  const save = () => {
    setProfile(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const totalSales = invoices.reduce((s, i) => s + i.total, 0);
  const todaySales = invoices
    .filter((i) => new Date(i.timestamp).toDateString() === new Date().toDateString())
    .reduce((s, i) => s + i.total, 0);

  const itemCounts = {};
  invoices.forEach((inv) => inv.items.forEach((it) => (itemCounts[it.name] = (itemCounts[it.name] || 0) + it.qty)));
  const topItems = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const maxCount = topItems[0]?.[1] || 1;

  const fields = [
    { key: "businessName", label: "Business name" },
    { key: "gst", label: "GST number" },
    { key: "phone", label: "Phone" },
    { key: "address", label: "Address" },
    { key: "taxRate", label: "Tax rate on bills (%)", numeric: true },
  ];

  return (
    <div className="px-5 pb-8">
      <div className="rounded-2xl p-4 mb-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <div className="f-display text-sm font-semibold mb-3" style={{ color: C.text }}>
          Business details
        </div>
        {fields.map((f) => (
          <div key={f.key} className="mb-3 last:mb-0">
            <label className="f-body text-[11px]" style={{ color: C.muted }}>
              {f.label}
            </label>
            <input
              value={form[f.key]}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              type={f.numeric ? "number" : "text"}
              className="f-body w-full text-sm rounded-lg px-3 py-2 mt-1 outline-none"
              style={{ background: C.surfaceAlt, color: C.text, border: `1px solid ${C.border}` }}
            />
          </div>
        ))}
        <button
          onClick={save}
          className="w-full mt-3 rounded-lg py-2.5 f-body text-sm font-semibold active:scale-[0.98] transition"
          style={{ background: saved ? C.success : C.accent, color: C.bg }}
        >
          {saved ? "Saved ✓" : "Save details"}
        </button>
      </div>

      <div className="rounded-2xl p-4 mb-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={15} color={C.accent} />
          <div className="f-display text-sm font-semibold" style={{ color: C.text }}>
            Sales analytics
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-xl p-3" style={{ background: C.surfaceAlt }}>
            <div className="f-mono text-lg font-bold" style={{ color: C.accent }}>
              {money(todaySales)}
            </div>
            <div className="f-body text-[11px]" style={{ color: C.muted }}>
              Today
            </div>
          </div>
          <div className="rounded-xl p-3" style={{ background: C.surfaceAlt }}>
            <div className="f-mono text-lg font-bold" style={{ color: C.text }}>
              {money(totalSales)}
            </div>
            <div className="f-body text-[11px]" style={{ color: C.muted }}>
              All time
            </div>
          </div>
        </div>
        {topItems.length > 0 && (
          <div>
            <div className="f-body text-[11px] mb-2" style={{ color: C.muted }}>
              Top sellers
            </div>
            {topItems.map(([name, count]) => (
              <div key={name} className="mb-2">
                <div className="flex justify-between f-body text-xs mb-1" style={{ color: C.text }}>
                  <span className="truncate pr-2">{name}</span>
                  <span className="f-mono flex-shrink-0" style={{ color: C.muted }}>{count}</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: C.surfaceAlt }}>
                  <div className="h-full rounded-full" style={{ width: `${(count / maxCount) * 100}%`, background: C.accent }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <BusinessAssistant profile={profile} invoices={invoices} products={products} />
    </div>
  );
}

/* ---------------------------------------------------------
   AI Business Assistant (persistent chat)
--------------------------------------------------------- */
function BusinessAssistant({ profile, invoices, products }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.chat);
      if (raw) setMessages(JSON.parse(raw));
    } catch (e) {
      /* no history yet */
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const persist = (msgs) => {
    try {
      localStorage.setItem(STORAGE_KEYS.chat, JSON.stringify(msgs));
    } catch (e) {
      /* best-effort */
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const next = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const context = `You are a helpful business assistant for a small retail shop${profile.businessName ? ` called "${profile.businessName}"` : ""}.
Total invoices recorded: ${invoices.length}. Total sales: ${money(invoices.reduce((s, i) => s + i.total, 0))}.
Current product count: ${products.length}, of which ${products.filter((p) => p.stock <= p.lowStock).length} are low on stock.
Answer the shopkeeper's question concisely and practically, in plain language, in 3-4 sentences max.`;
      const history = next.map((m) => `${m.role === "user" ? "Shopkeeper" : "Assistant"}: ${m.content}`).join("\n");
      const reply = await callClaude(`${context}\n\nConversation so far:\n${history}\n\nAssistant:`, { maxTokens: 350 });
      const final = [...next, { role: "assistant", content: reply.trim() }];
      setMessages(final);
      persist(final);
    } catch (e) {
      const final = [...next, { role: "assistant", content: "Sorry, I couldn't reach the assistant just now. Try again in a moment." }];
      setMessages(final);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl p-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
      <div className="flex items-center gap-2 mb-3">
        <MessageCircle size={15} color={C.accent} />
        <div className="f-display text-sm font-semibold" style={{ color: C.text }}>
          AI Business Assistant
        </div>
      </div>
      <div ref={scrollRef} className="max-h-56 overflow-y-auto mb-3 space-y-2">
        {messages.length === 0 && (
          <div className="f-body text-xs" style={{ color: C.faint }}>
            Ask about sales trends, restocking, or pricing ideas.
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className="f-body text-xs rounded-xl px-3 py-2 max-w-[85%]"
              style={{ background: m.role === "user" ? C.accentSoft : C.surfaceAlt, color: m.role === "user" ? C.accent : C.text }}
            >
              {m.content}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="f-body text-xs rounded-xl px-3 py-2" style={{ background: C.surfaceAlt, color: C.muted }}>
              <Loader2 size={12} className="inline animate-spin mr-1" /> thinking…
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Ask something…"
          className="f-body flex-1 text-sm rounded-xl px-3 py-2.5 outline-none"
          style={{ background: C.surfaceAlt, color: C.text, border: `1px solid ${C.border}` }}
        />
        <button
          onClick={send}
          disabled={busy}
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 active:scale-95 transition"
          style={{ background: C.accentSoft }}
        >
          <Send size={16} color={C.accent} />
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   App
--------------------------------------------------------- */
export default function App() {
  const [tab, setTab] = useState("home");
  const [products, setProducts] = useState(DEFAULT_PRODUCTS);
  const [invoices, setInvoices] = useState([]);
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [cart, setCart] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);

  // load
  useEffect(() => {
    try {
      const pr = localStorage.getItem(STORAGE_KEYS.products);
      const inv = localStorage.getItem(STORAGE_KEYS.invoices);
      const prof = localStorage.getItem(STORAGE_KEYS.profile);
      if (pr) setProducts(JSON.parse(pr));
      if (inv) setInvoices(JSON.parse(inv));
      if (prof) setProfile(JSON.parse(prof));
    } catch (e) {
      /* fall back to defaults */
    } finally {
      setLoaded(true);
    }
  }, []);

  // persist on change (after initial load)
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEYS.products, JSON.stringify(products));
    } catch (e) {}
  }, [products, loaded]);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEYS.invoices, JSON.stringify(invoices));
    } catch (e) {}
  }, [invoices, loaded]);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(profile));
    } catch (e) {}
  }, [profile, loaded]);

  const adjustCart = (id, delta) => {
    setCart((prev) => {
      const p = products.find((x) => x.id === id);
      const cur = prev[id] || 0;
      const next = Math.max(0, Math.min(p?.stock ?? 0, cur + delta));
      return { ...prev, [id]: next };
    });
  };

  const applyParsedItems = (items) => {
    items.forEach(({ id, qty }) => {
      const p = products.find((x) => x.id === id);
      if (!p) return;
      setCart((prev) => {
        const cur = prev[id] || 0;
        const next = Math.max(0, Math.min(p.stock, cur + Number(qty || 1)));
        return { ...prev, [id]: next };
      });
    });
  };

  const confirmCheckout = (lines, grandTotal) => {
    const invoice = { id: uid(), timestamp: Date.now(), items: lines, total: grandTotal };
    setInvoices((prev) => [...prev, invoice]);
    setProducts((prev) =>
      prev.map((p) => {
        const line = lines.find((l) => l.id === p.id);
        return line ? { ...p, stock: Math.max(0, p.stock - line.qty) } : p;
      })
    );
    setCart({});
  };

  // Inventory CRUD — the only place products are managed
  const addProduct = (payload) => setProducts((prev) => [...prev, { id: uid(), ...payload }]);
  const updateProduct = (id, payload) => setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...payload } : p)));
  const deleteProduct = (id) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
    setCart((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const cartCount = Object.values(cart).reduce((s, q) => s + q, 0);
  const cartTotal = Object.entries(cart).reduce((s, [id, q]) => {
    const p = products.find((x) => x.id === id);
    return s + (p ? p.price * q : 0);
  }, 0);

  const titles = {
    home: { eyebrow: "Counter", title: profile.businessName || "Your Store" },
    inventory: { eyebrow: "Stock", title: "Inventory" },
    history: { eyebrow: "Records", title: "Invoice history" },
    profile: { eyebrow: "Account", title: "Business profile" },
  };

  return (
    <div
      className="f-body flex flex-col"
      style={{ background: C.bg, maxWidth: 480, margin: "0 auto", position: "relative", height: "100vh", overflow: "hidden" }}
    >
      <FontStyle />
      <div className="flex-shrink-0">
        <Header title={titles[tab].title} eyebrow={titles[tab].eyebrow} />
      </div>

      {!loaded ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin" color={C.accent} />
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col">
          {tab === "home" && (
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="flex-shrink-0">
                <VoiceToBillCard products={products} onParsed={applyParsedItems} />
              </div>
              <div className="flex-1 min-h-0 mt-4">
                <BillingList products={products} cart={cart} onAdjust={adjustCart} bottomPad={24} />
              </div>
              <CheckoutBar count={cartCount} total={cartTotal} onOpen={() => setShowCheckout(true)} />
            </div>
          )}
          {tab === "inventory" && (
            <InventoryTab products={products} onAdd={addProduct} onUpdate={updateProduct} onDelete={deleteProduct} />
          )}
          {tab === "history" && (
            <div className="flex-1 min-h-0 overflow-y-auto">
              <HistoryTab invoices={invoices} />
            </div>
          )}
          {tab === "profile" && (
            <div className="flex-1 min-h-0 overflow-y-auto">
              <ProfileTab profile={profile} setProfile={setProfile} invoices={invoices} products={products} />
            </div>
          )}
        </div>
      )}

      <BottomNav tab={tab} setTab={setTab} />
      <CheckoutModal
        open={showCheckout}
        onClose={() => setShowCheckout(false)}
        cart={cart}
        products={products}
        profile={profile}
        onConfirm={confirmCheckout}
      />
    </div>
  );
}
