import React, { useState, useEffect, useMemo } from 'react';
import { auth, db } from './firebase'; 
import { 
  signInAnonymously, 
  onAuthStateChanged,
  signInWithCustomToken
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  query, 
  onSnapshot, 
  orderBy, 
  serverTimestamp,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  updateDoc,
  writeBatch,
  getDocs
} from 'firebase/firestore';
import { 
  Upload, Download, Search, Plus, Trash2, CheckCircle, AlertCircle, 
  Menu, X, Settings, Database, DollarSign, Mail, Phone, User, 
  FileText, Image as ImageIcon, Sparkles, Loader2, Camera, Lightbulb, 
  Bug, BrainCircuit, Check, CheckSquare, Square, Clock, Send, Archive, 
  Lock, Key
} from 'lucide-react';

/* --- CONFIGURATION --- */
// This ID separates your data from others in the database.
// In a real app, this would just be your root collection structure.
const appId = 'broken-tcg-prod'; 

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || ""; 

const callGemini = async (prompt, systemInstruction = "", imageBase64 = null) => {
  if (!GEMINI_API_KEY) {
      console.error("Gemini API Key missing");
      return "AI Error: API Key missing";
  }
  try {
    const parts = [{ text: prompt }];
    if (imageBase64) {
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: imageBase64
        }
      });
    }
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: parts }],
          systemInstruction: { parts: [{ text: systemInstruction }] },
        }),
      }
    );
    if (!response.ok) throw new Error(`Gemini API Error: ${response.statusText}`);
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  } catch (error) {
    console.error("Gemini Call Failed", error);
    throw error;
  }
};

// --- Helper: Improved CSV Parser ---
const parseCSV = (text) => {
  const cleanText = text.replace(/^\uFEFF/, '');
  const lines = cleanText.split(/\r\n|\n|\r/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
  
  return lines.slice(1).map(line => {
    const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/^"|"$/g, ''));
    const obj = {};
    headers.forEach((h, i) => { obj[h] = values[i] || ''; });
    return obj;
  });
};

const exportToCSV = (data, filename) => {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(fieldName => `"${row[fieldName]}"`).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

/* --- ADMIN LOGIN MODAL --- */
function AdminLoginModal({ onClose, onSuccess, notify }) {
  const [view, setView] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    setTimeout(() => {
      if (email === 'deadlybroken25@gmail.com' && password === 'Deadbroke123!@#') {
        notify("Admin Access Granted");
        onSuccess();
      } else {
        setError("Invalid credentials. Access Denied.");
        setIsLoading(false);
      }
    }, 800);
  };

  const handleForgot = (e) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      notify(`Reset link sent to ${email || 'your email'}`);
      setView('login');
      setIsLoading(false);
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition"><X size={20} /></button>
        <div className="p-8">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center"><Lock size={32} /></div>
          </div>
          <h2 className="text-2xl font-bold text-center text-slate-800 mb-1">{view === 'login' ? 'Admin Login' : 'Recover Password'}</h2>
          <p className="text-center text-gray-500 text-sm mb-6">{view === 'login' ? 'Secure access for authorized personnel only.' : 'Enter your email to receive a reset link.'}</p>
          {view === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 text-gray-400" size={18} />
                  <input type="email" required className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition outline-none" placeholder="admin@example.com" value={email} onChange={e => setEmail(e.target.value)}/>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Password</label>
                <div className="relative">
                  <Key className="absolute left-3 top-3 text-gray-400" size={18} />
                  <input type="password" required className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition outline-none" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)}/>
                </div>
              </div>
              {error && <div className="text-red-500 text-sm font-medium text-center bg-red-50 p-2 rounded">{error}</div>}
              <button type="submit" disabled={isLoading} className="w-full bg-slate-900 text-white py-3 rounded-lg font-bold hover:bg-slate-800 transition flex justify-center items-center disabled:opacity-70">{isLoading ? <Loader2 className="animate-spin" /> : 'Login to Dashboard'}</button>
              <div className="text-center mt-4"><button type="button" onClick={() => setView('forgot')} className="text-sm text-blue-600 hover:underline">Forgot your password?</button></div>
            </form>
          ) : (
            <form onSubmit={handleForgot} className="space-y-4">
               <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Registered Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 text-gray-400" size={18} />
                  <input type="email" required className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition outline-none" placeholder="admin@example.com" value={email} onChange={e => setEmail(e.target.value)}/>
                </div>
              </div>
              <button type="submit" disabled={isLoading} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition flex justify-center items-center disabled:opacity-70">{isLoading ? <Loader2 className="animate-spin" /> : 'Send Reset Link'}</button>
              <div className="text-center mt-4"><button type="button" onClick={() => setView('login')} className="text-sm text-gray-500 hover:text-gray-800">&larr; Back to Login</button></div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('home');
  const [settings, setSettings] = useState({
    bannerUrl: 'https://images.unsplash.com/photo-1613771404784-3a5686aa2be3?auto=format&fit=crop&q=80&w=2069',
    logoUrl: '', 
    hotBuysImages: [],
    promoText: 'We buy your cards! 70% - 90% Market Value Paid.',
    businessName: 'Broken TCG'
  });
  const [isAdminMode, setIsAdminMode] = useState(false); 
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [notification, setNotification] = useState(null); 

  useEffect(() => {
    if (!auth) return;
    signInAnonymously(auth).catch(console.error);
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !db) return;
    const settingsRef = doc(db, 'artifacts', appId, 'public', 'data', 'site_settings', 'main');
    const unsubSettings = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSettings(prev => ({ ...prev, businessName: data.businessName || prev.businessName, promoText: data.promoText || prev.promoText }));
      }
    });
    const imagesRef = collection(db, 'artifacts', appId, 'public', 'data', 'site_images');
    const unsubImages = onSnapshot(imagesRef, (snap) => {
        let logo = ''; let banner = ''; const slides = [];
        snap.docs.forEach(d => {
            const id = d.id; const data = d.data();
            if (id === 'logo') logo = data.image;
            else if (id === 'banner') banner = data.image;
            else if (id.startsWith('slide_')) slides[data.index] = data.image;
        });
        setSettings(prev => ({ ...prev, logoUrl: logo || prev.logoUrl, bannerUrl: banner || prev.bannerUrl, hotBuysImages: slides.filter(s=>s).length > 0 ? slides.filter(s=>s) : prev.hotBuysImages }));
    });
    return () => { unsubSettings(); unsubImages(); };
  }, [user]);

  const showNotification = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleAdminLoginSuccess = () => {
    setIsAdminMode(true);
    setShowAdminLogin(false);
    setView('admin');
  };

  const handleTCGExport = (cards, customerName) => {
     const conditionMap = { 'NM': 'Near Mint', 'LP': 'Lightly Played', 'MP': 'Moderately Played', 'HP': 'Heavily Played', 'DMG': 'Damaged' };
     const exportData = cards.map(c => ({
       'Product Name': c.name, 'Set Name': c.set, 'Total Quantity': c.quantity || 1,
       'Condition': conditionMap[c.condition] || c.condition || 'Near Mint', 'TCG Player ID': ''
     }));
     exportToCSV(exportData, `TCG_Seller_Export_${customerName}.csv`);
  };

  if (!auth) return <div className="flex h-screen items-center justify-center text-gray-500 flex-col"><div>Configuring System...</div><div className="text-xs text-gray-400 mt-2">Please ensure .env file is set up</div></div>;
  if (!user) return <div className="flex h-screen items-center justify-center text-gray-500">Loading System...</div>;

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-slate-900">
      {notification && (
        <div className={`fixed top-4 right-4 z-[60] px-6 py-3 rounded-lg shadow-xl text-white animate-fade-in ${notification.type === 'error' ? 'bg-red-600' : 'bg-slate-800'}`}>
           {notification.msg}
        </div>
      )}
      {showAdminLogin && <AdminLoginModal onClose={() => setShowAdminLogin(false)} onSuccess={handleAdminLoginSuccess} notify={showNotification} />}
      
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center cursor-pointer" onClick={() => setView('home')}>
              {settings.logoUrl ? <img src={settings.logoUrl} alt="Logo" className="h-10 w-10 object-contain mr-3 rounded-lg" onError={(e) => {e.target.style.display='none';}} /> : <div className="bg-red-600 text-white p-2 rounded-lg mr-3"><Database size={24} /></div>}
              <span className="font-bold text-xl tracking-tight text-slate-800">{settings.businessName || 'Broken TCG'}</span>
            </div>
            <div className="flex items-center space-x-4">
              <button onClick={() => setView('home')} className={`px-3 py-2 rounded-md text-sm font-medium ${view === 'home' ? 'text-red-600 bg-red-50' : 'text-gray-600 hover:text-gray-900'}`}>Home</button>
              <button onClick={() => setView('sell')} className={`px-3 py-2 rounded-md text-sm font-medium ${view === 'sell' ? 'text-red-600 bg-red-50' : 'text-gray-600 hover:text-gray-900'}`}>Sell Cards</button>
              <div className="border-l pl-4 ml-2">
                 <button onClick={() => { if (isAdminMode) { setIsAdminMode(false); setView('home'); showNotification("Logged out of Admin Console", "success"); } else { setShowAdminLogin(true); } }} className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${isAdminMode ? 'bg-slate-800 text-white' : 'text-gray-400 hover:text-gray-600'}`}>
                  <Settings size={16} className="mr-1" /> {isAdminMode ? 'Admin Logout' : 'Admin Login'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {view === 'home' && <HomeView settings={settings} setView={setView} />}
        {view === 'sell' && <SellView user={user} settings={settings} onSuccess={() => setView('success')} notify={showNotification} />}
        {view === 'success' && <SuccessView setView={setView} />}
        {view === 'admin' && isAdminMode && <AdminDashboard user={user} settings={settings} setSettings={setSettings} notify={showNotification} onExport={handleTCGExport} />}
      </main>
    </div>
  );
}

/* --- SUB-COMPONENTS --- */

function HomeView({ settings, setView }) {
  const [currentSlide, setCurrentSlide] = useState(0);
  useEffect(() => {
    if (!settings.hotBuysImages || settings.hotBuysImages.length === 0) return;
    const timer = setInterval(() => { setCurrentSlide(prev => (prev + 1) % settings.hotBuysImages.length); }, 1500);
    return () => clearInterval(timer);
  }, [settings.hotBuysImages]);

  return (
    <div className="space-y-12 animate-fade-in">
      <div className="relative rounded-2xl overflow-hidden shadow-xl bg-slate-900 text-white min-h-[500px] flex items-center">
        <img src={settings.bannerUrl} alt="Pokemon Cards" className="absolute inset-0 w-full h-full object-cover opacity-30" onError={(e) => e.target.src = 'https://images.unsplash.com/photo-1613771404784-3a5686aa2be3?auto=format&fit=crop&q=80&w=2069'} />
        <div className="relative z-10 w-full max-w-7xl mx-auto px-8 md:px-16 grid md:grid-cols-2 gap-12 items-center">
          <div className="max-w-2xl">
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-4">Turn Your Collection <br/> Into Cash.</h1>
            <p className="text-xl md:text-2xl text-gray-200 mb-8 font-light border-l-4 border-red-500 pl-4">{settings.promoText}</p>
            <button onClick={() => setView('sell')} className="bg-red-600 hover:bg-red-700 text-white text-lg font-bold py-4 px-8 rounded-lg shadow-lg transform transition hover:-translate-y-1 flex items-center">Start Selling Now <span className="ml-2"><DollarSign size={20}/></span></button>
          </div>
          {settings.hotBuysImages && settings.hotBuysImages.length > 0 && (
            <div className="hidden md:flex flex-col items-center justify-center">
               <div className="mb-4"><h2 className="text-3xl font-extrabold text-yellow-400 flex items-center drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]"><Sparkles className="mr-2 animate-pulse" fill="currentColor" /> HOT BUYS</h2></div>
               <div className="relative w-64 h-[360px] bg-white/10 backdrop-blur-md rounded-xl border-4 border-yellow-400/70 shadow-2xl transform rotate-3 hover:rotate-0 transition duration-500 p-1">
                  <div className="w-full h-full rounded-lg overflow-hidden relative bg-slate-800">
                      {settings.hotBuysImages.map((img, idx) => (
                          <img key={idx} src={img} className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-500 ${idx === currentSlide ? 'opacity-100' : 'opacity-0'}`} alt={`Hot Buy ${idx + 1}`} />
                      ))}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 pointer-events-none rounded-lg"></div>
               </div>
            </div>
          )}
        </div>
      </div>
      <div className="grid md:grid-cols-3 gap-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center mb-4"><Upload size={24} /></div>
          <h3 className="text-xl font-bold mb-2">1. Upload List</h3>
          <p className="text-gray-600">Manually enter cards, use <b>AI Smart Paste</b>, or <b>Scan with Camera!</b></p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="w-12 h-12 bg-green-100 text-green-600 rounded-lg flex items-center justify-center mb-4"><Search size={24} /></div>
          <h3 className="text-xl font-bold mb-2">2. We Compare</h3>
          <p className="text-gray-600">Our system automatically checks your list against our current Buying List.</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center mb-4"><DollarSign size={24} /></div>
          <h3 className="text-xl font-bold mb-2">3. Get Paid</h3>
          <p className="text-gray-600">We notify you of accepted cards. Ship them to us and receive payment quickly.</p>
        </div>
      </div>
    </div>
  );
}

function SellView({ user, onSuccess, settings, notify }) {
  const [step, setStep] = useState(1);
  const [customerInfo, setCustomerInfo] = useState({ firstName: '', email: '', phone: '' });
  const [cards, setCards] = useState([{ id: 1, name: '', set: '', number: '', condition: 'NM', quantity: 1 }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [scanningRowId, setScanningRowId] = useState(null);

  const handleAddRow = () => setCards([...cards, { id: Date.now(), name: '', set: '', number: '', condition: 'NM', quantity: 1 }]);
  const handleRemoveRow = (id) => { if (cards.length > 1) setCards(cards.filter(c => c.id !== id)); };
  const updateCard = (id, field, value) => setCards(cards.map(c => c.id === id ? { ...c, [field]: value } : c));
  
  const handleAIImport = async () => {
    if (!aiInput.trim()) return;
    setIsAiLoading(true);
    try {
      const prompt = `You are a data parser. Extract Pokemon cards from this text. Return strictly a JSON array of objects with keys: "name", "set", "number", "condition", "quantity". If condition is missing, use "NM". If quantity is missing, use 1. If info is missing, use empty string. Text: "${aiInput}"`;
      const result = await callGemini(prompt, "Return only raw JSON. No markdown.");
      const cleanJson = result.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsedData = JSON.parse(cleanJson);
      if (Array.isArray(parsedData)) {
        const newCards = parsedData.map((item, idx) => ({ id: Date.now() + idx, name: item.name || '', set: item.set || '', number: item.number || '', condition: item.condition || 'NM', quantity: item.quantity || 1 }));
        setCards(prev => [...prev, ...newCards]);
        notify(`✨ AI extracted ${newCards.length} cards!`);
        setShowAIModal(false);
        setAiInput('');
      } else { throw new Error("Invalid AI response format"); }
    } catch (err) { console.error(err); notify("Could not extract cards.", "error"); } finally { setIsAiLoading(false); }
  };

  const handleImageScan = (e, rowId) => {
     const file = e.target.files[0]; if (!file) return; setScanningRowId(rowId);
     const reader = new FileReader();
     reader.onloadend = async () => {
        try {
           const result = await callGemini(`Look at this Pokemon card. Identify the Name, Set Name, Card Number, and estimate Condition (NM, LP, MP, HP, DMG). Return strictly JSON object with keys: name, set, number, condition.`, "Return only raw JSON. No markdown.", reader.result.split(',')[1]);
           const data = JSON.parse(result.replace(/```json/g, '').replace(/```/g, '').trim());
           setCards(prev => prev.map(c => c.id === rowId ? { ...c, name: data.name || c.name, set: data.set || c.set, number: data.number || c.number, condition: data.condition || 'NM', quantity: c.quantity || 1 } : c));
           notify("✨ Card Scanned Successfully!");
        } catch (err) { notify("Could not identify card.", "error"); } finally { setScanningRowId(null); }
     };
     reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!customerInfo.firstName || !customerInfo.email) { setError("Please provide at least your Name and Email."); return; }
    if (cards.length === 0 || (cards.length === 1 && !cards[0].name)) { setError("Please list at least one card."); return; }
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'submissions'), { customer: customerInfo, cards: cards, status: 'pending', submittedAt: serverTimestamp() });
      onSuccess();
    } catch (err) { setError("Failed to submit. Please try again."); } finally { setIsSubmitting(false); }
  };

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden animate-fade-in relative">
      {showAIModal && (
        <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center p-8">
          <div className="w-full max-w-xl bg-white border-2 border-purple-100 shadow-2xl rounded-2xl p-6">
            <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold text-purple-800 flex items-center"><Sparkles className="mr-2 text-purple-500" /> AI Smart Import</h3><button onClick={() => setShowAIModal(false)}><X size={24} className="text-gray-400 hover:text-gray-600" /></button></div>
            <p className="text-gray-600 mb-4 text-sm">Paste a messy list, an email, or a message. Our AI will clean it up and extract the card details for you.</p>
            <textarea className="w-full h-40 p-3 border border-gray-200 rounded-lg mb-4 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm" placeholder={"Example:\nI have 2 Charizard from Base Set (4/102) in Near Mint condition."} value={aiInput} onChange={e => setAiInput(e.target.value)}></textarea>
            <div className="flex justify-end space-x-3"><button onClick={() => setShowAIModal(false)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg">Cancel</button><button onClick={handleAIImport} disabled={isAiLoading || !aiInput.trim()} className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium flex items-center disabled:opacity-50">{isAiLoading ? <><Loader2 className="animate-spin mr-2" size={18}/> Processing...</> : '✨ Extract Cards'}</button></div>
          </div>
        </div>
      )}
      <div className="bg-slate-800 p-6 text-white flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Submit Your Buy List</h2>
          <p className="text-slate-300 text-sm">We are paying 70-90% Market Price!</p>
          <p className="text-yellow-400 text-xs mt-1 font-semibold">Please use the AI Paste feature for TCG Player and Collector Sell List</p>
        </div>
        <div className="text-right text-sm text-slate-400">Step {step} of 2</div>
      </div>
      {step === 1 && (
        <div className="p-8">
          <h3 className="text-lg font-semibold mb-4 flex items-center"><User className="mr-2" /> Contact Information</h3>
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label><input type="text" className="w-full p-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500" value={customerInfo.firstName} onChange={e => setCustomerInfo({...customerInfo, firstName: e.target.value})} placeholder="Ash Ketchum"/></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label><input type="email" className="w-full p-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500" value={customerInfo.email} onChange={e => setCustomerInfo({...customerInfo, email: e.target.value})} placeholder="ash@pallet-town.com"/></div>
            <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label><input type="tel" className="w-full p-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500" value={customerInfo.phone} onChange={e => setCustomerInfo({...customerInfo, phone: e.target.value})} placeholder="(555) 123-4567"/></div>
          </div>
          <div className="flex justify-end"><button onClick={() => setStep(2)} className="bg-slate-800 text-white px-6 py-2 rounded-md hover:bg-slate-900 transition">Next: Add Cards</button></div>
        </div>
      )}
      {step === 2 && (
        <div className="p-8">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold flex items-center"><Database className="mr-2" /> Card List</h3>
            <div className="flex space-x-2">
               <button onClick={() => setShowAIModal(true)} className="bg-purple-100 text-purple-700 border border-purple-200 px-4 py-2 rounded-md hover:bg-purple-200 text-sm font-bold transition flex items-center"><Sparkles size={16} className="mr-2"/> AI Paste</button>
               {/* REVERTED: Added CSV Upload back */}
               <label className="cursor-pointer bg-green-50 text-green-600 px-4 py-2 rounded-md hover:bg-green-100 text-sm font-medium transition flex items-center">
                  <Upload size={16} className="mr-2"/> Upload CSV
                  <input type="file" accept=".csv" className="hidden" onChange={handleCSVUpload} />
               </label>
               <button onClick={handleAddRow} className="bg-blue-50 text-blue-600 px-4 py-2 rounded-md hover:bg-blue-100 text-sm font-medium transition flex items-center"><Plus size={16} className="mr-2"/> Add Row</button>
            </div>
          </div>
          <div className="overflow-x-auto mb-6 border rounded-lg max-h-[500px] overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200">
               <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">Scan</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Card Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Set Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Number</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Qty</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Condition</th>
                  <th className="px-4 py-3 w-12"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {cards.map((card, index) => (
                  <tr key={card.id}>
                     <td className="px-4 py-2"><label className="flex items-center justify-center w-8 h-8 rounded-full cursor-pointer bg-gray-100 hover:bg-purple-100"><Camera size={16}/><input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageScan(e, card.id)}/></label></td>
                     <td className="px-4 py-2"><input type="text" className="w-full border-gray-300 rounded-md text-sm" value={card.name} onChange={(e) => updateCard(card.id, 'name', e.target.value)} placeholder="Name"/></td>
                     <td className="px-4 py-2"><input type="text" className="w-full border-gray-300 rounded-md text-sm" value={card.set} onChange={(e) => updateCard(card.id, 'set', e.target.value)} placeholder="Set"/></td>
                     <td className="px-4 py-2"><input type="text" className="w-full border-gray-300 rounded-md text-sm" value={card.number} onChange={(e) => updateCard(card.id, 'number', e.target.value)} placeholder="#"/></td>
                     <td className="px-4 py-2"><input type="number" min="1" className="w-full border-gray-300 rounded-md text-sm" value={card.quantity} onChange={(e) => updateCard(card.id, 'quantity', e.target.value)}/></td>
                     <td className="px-4 py-2"><select className="w-full border-gray-300 rounded-md text-sm" value={card.condition} onChange={(e) => updateCard(card.id, 'condition', e.target.value)}><option value="NM">NM</option><option value="LP">LP</option><option value="MP">MP</option><option value="HP">HP</option><option value="DMG">DMG</option></select></td>
                     <td className="px-4 py-2"><button onClick={() => handleRemoveRow(card.id)} className="text-red-400"><Trash2 size={18}/></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 flex items-center"><AlertCircle size={20} className="mr-2" /> {error}</div>}
          <div className="flex justify-between border-t pt-6"><button onClick={() => setStep(1)} className="text-gray-600 hover:text-gray-900 px-4 py-2">Back</button><button onClick={handleSubmit} disabled={isSubmitting} className={`bg-red-600 text-white px-8 py-2 rounded-md hover:bg-red-700 transition shadow-md flex items-center ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}>{isSubmitting ? 'Submitting...' : 'Submit List for Review'}</button></div>
        </div>
      )}
    </div>
  );
}

function SuccessView({ setView }) {
  return (
    <div className="max-w-lg mx-auto bg-white rounded-xl shadow-lg p-12 text-center animate-fade-in">
      <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6"><CheckCircle size={48} /></div>
      <h2 className="text-3xl font-bold text-slate-800 mb-4">Submission Received!</h2>
      <p className="text-gray-600 mb-8">Thanks for sending us your list. We will email you shortly.</p>
      <button onClick={() => setView('home')} className="bg-slate-800 text-white px-6 py-3 rounded-lg hover:bg-slate-900">Return Home</button>
    </div>
  );
}

function AdminDashboard({ user, settings, setSettings, notify, onExport }) {
  const [tab, setTab] = useState('submissions'); 
  const [buyList, setBuyList] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [isLoadingBuyList, setIsLoadingBuyList] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [debugMode, setDebugMode] = useState(false); 

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'submissions'), orderBy('submittedAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setSubmissions(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const fetchBuyList = async () => {
       try {
          const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'buylist_chunks'));
          const snapshot = await getDocs(q);
          let allCards = [];
          snapshot.forEach(doc => {
            if(doc.data().data) {
              allCards = [...allCards, ...doc.data().data];
            }
          });
          setBuyList(allCards);
       } catch(err) {
         console.error("Failed to load master list chunks", err);
       }
    };
    fetchBuyList();
  }, [user]);

  const handleBuyListUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsLoadingBuyList(true);
    setUploadProgress('Reading File...');

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target.result;
      const parsed = parseCSV(text);
      
      if (parsed.length === 0) {
        notify("No valid data found in CSV.", "error");
        setIsLoadingBuyList(false);
        return;
      }

      try {
        const cleanData = parsed.map(p => {
          let name = p.name || p['card name'] || p['product name'] || p['title'] || '';
          let set = p.set || p['set name'] || p['expansion'] || p['edition'] || '';
          let number = p.number || p['number'] || p['card number'] || p['set number'] || p['#'] || p['code'] || '';
          
          if (!set && name) {
             const bracketMatch = name.match(/^(.*)\s\[(.*)\]$/);
             if (bracketMatch) { name = bracketMatch[1].trim(); set = bracketMatch[2].trim(); } 
             else {
               const parenMatch = name.match(/^(.*)\s\((.*)\)$/);
               if (parenMatch) { name = parenMatch[1].trim(); set = parenMatch[2].trim(); } 
               else {
                 const dashSplit = name.split(' - ');
                 if(dashSplit.length > 1) { const possibleSet = dashSplit.pop(); name = dashSplit.join(' - ').trim(); set = possibleSet.trim(); }
               }
             }
          }

          let rawPrice = p['buy_price'] || p['buy price'] || p['market price'] || p['price'] || '0';
          rawPrice = String(rawPrice).replace(/[^0-9.]/g, '');
          const basePrice = parseFloat(rawPrice) || 0;
          const calculatedBuyPrice = (basePrice * 0.75).toFixed(2);

          return {
            name: name,
            set: set,
            number: number,
            condition: p.condition || 'NM', 
            price: calculatedBuyPrice
          };
        }).filter(x => x.name && x.name.trim() !== '');

        setUploadProgress(`Found ${cleanData.length} items. Clearing old data...`);

        const chunksRef = collection(db, 'artifacts', appId, 'public', 'data', 'buylist_chunks');
        const oldChunksSnap = await getDocs(chunksRef);
        const deleteBatch = writeBatch(db);
        oldChunksSnap.docs.forEach(d => deleteBatch.delete(d.ref));
        await deleteBatch.commit();

        const CHUNK_SIZE = 2000; 
        const chunks = [];
        for (let i = 0; i < cleanData.length; i += CHUNK_SIZE) {
          chunks.push(cleanData.slice(i, i + CHUNK_SIZE));
        }
        setUploadProgress(`Uploading ${chunks.length} chunks...`);

        await Promise.all(chunks.map(async (chunkData, index) => {
           const chunkDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'buylist_chunks', `chunk_${index}`);
           await setDoc(chunkDocRef, { index: index, count: chunkData.length, data: chunkData, updatedAt: serverTimestamp() });
        }));

        setBuyList(cleanData);
        notify(`Success! ${cleanData.length} cards indexed.`);
      } catch (err) { console.error(err); notify("Error uploading Buy List.", "error"); } finally { setIsLoadingBuyList(false); setUploadProgress(''); }
    };
    reader.readAsText(file);
  };

  const handleUpdateSettings = async (newSettings) => {
     const { hotBuysImages, ...textSettings } = newSettings;
     const batch = writeBatch(db);
     
     const settingsRef = doc(db, 'artifacts', appId, 'public', 'data', 'site_settings', 'main');
     batch.set(settingsRef, textSettings, { merge: true });

     const imagesCollection = collection(db, 'artifacts', appId, 'public', 'data', 'site_images');
     
     if (newSettings.logoUrl) { batch.set(doc(imagesCollection, 'logo'), { image: newSettings.logoUrl }); }
     if (newSettings.bannerUrl) { batch.set(doc(imagesCollection, 'banner'), { image: newSettings.bannerUrl }); }

     const existingDocs = await getDocs(imagesCollection);
     existingDocs.forEach(d => { if (d.id.startsWith('slide_')) { batch.delete(d.ref); } });
     
     if (hotBuysImages && hotBuysImages.length > 0) {
         hotBuysImages.forEach((img, idx) => { if (img) { batch.set(doc(imagesCollection, `slide_${idx}`), { index: idx, image: img }); } });
     }

     await batch.commit();
     notify("Settings Saved");
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0]; if(!file) return;
    const reader = new FileReader(); reader.onloadend = () => { setSettings(prev => ({ ...prev, logoUrl: reader.result })); }; reader.readAsDataURL(file);
  };
  
  const handleAddHotBuyImages = async (e) => {
    const files = Array.from(e.target.files); if (!files.length) return;
    const promises = files.map(file => { return new Promise((resolve) => { const reader = new FileReader(); reader.onloadend = () => resolve(reader.result); reader.readAsDataURL(file); }); });
    const newImages = await Promise.all(promises);
    setSettings(prev => ({ ...prev, hotBuysImages: [...(prev.hotBuysImages || []), ...newImages] }));
  };

  const handleRemoveHotBuyImage = (index) => { setSettings(prev => ({ ...prev, hotBuysImages: prev.hotBuysImages.filter((_, i) => i !== index) })); };

  const normalizeForMatch = (val) => { if (!val) return ''; return String(val).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, ""); };
  const normalizeNumber = (val) => { if (!val) return ''; let s = String(val).toLowerCase().trim(); s = s.split('/')[0]; s = s.replace(/^0+/, ''); return s.replace(/[^a-z0-9]/g, ""); };

  const findStrictMatches = (submissionCards) => {
    if (!buyList.length) return {};
    const buyListMap = new Map();
    buyList.forEach(b => { const n = normalizeForMatch(b.name); const s = normalizeForMatch(b.set); const key = `${n}|${s}`; if (!buyListMap.has(key)) buyListMap.set(key, b); });
    const results = {}; 
    submissionCards.forEach((c, i) => { const n = normalizeForMatch(c.name); const s = normalizeForMatch(c.set); const key = `${n}|${s}`; if (buyListMap.has(key)) { results[i] = buyListMap.get(key); } });
    return results;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm min-h-[600px] flex overflow-hidden">
      <div className="w-64 bg-slate-50 border-r border-gray-200 p-4 flex flex-col">
        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Admin Console</div>
        <button onClick={() => setTab('submissions')} className={`flex items-center w-full px-4 py-3 rounded-lg mb-2 text-sm font-medium ${tab === 'submissions' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}><FileText size={18} className="mr-3" /> Submissions {submissions.length > 0 && <span className="ml-auto bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs">{submissions.length}</span>}</button>
        <button onClick={() => setTab('buylist')} className={`flex items-center w-full px-4 py-3 rounded-lg mb-2 text-sm font-medium ${tab === 'buylist' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}><Database size={18} className="mr-3" /> Buy List Data</button>
        <button onClick={() => setTab('settings')} className={`flex items-center w-full px-4 py-3 rounded-lg mb-2 text-sm font-medium ${tab === 'settings' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}><Settings size={18} className="mr-3" /> Site Settings</button>
      </div>
      <div className="flex-1 p-8 overflow-y-auto">
        {tab === 'submissions' && (
          <div>
             {!selectedSubmission ? (
               <>
                 <h2 className="text-2xl font-bold mb-6">Incoming Lists</h2>
                 <div className="space-y-4">
                   {submissions.map(sub => {
                      const getStatusColor = (s) => { switch(s) { case 'contacted': return 'bg-blue-100 text-blue-700 border-blue-200'; case 'finalized': return 'bg-green-100 text-green-700 border-green-200'; default: return 'bg-yellow-100 text-yellow-700 border-yellow-200'; } };
                      return (
                     <div key={sub.id} onClick={() => setSelectedSubmission(sub)} className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 cursor-pointer transition shadow-sm flex justify-between items-center">
                        <div><h4 className="font-bold text-lg">{sub.customer.firstName}</h4><div className="text-sm text-gray-500 flex items-center space-x-4"><span className="flex items-center"><Mail size={14} className="mr-1"/> {sub.customer.email}</span><span className="flex items-center"><FileText size={14} className="mr-1"/> {sub.cards.length} Cards Listed</span></div></div>
                        <div className="text-right"><span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase border ${getStatusColor(sub.status || 'pending')}`}>{sub.status || 'Pending'}</span><div className="text-xs text-gray-400 mt-1">{sub.submittedAt?.toDate().toLocaleDateString()}</div></div>
                     </div>
                   )})}
                   {submissions.length === 0 && <div className="text-gray-400 text-center py-12">No submissions yet.</div>}
                 </div>
               </>
             ) : (
               <SubmissionDetail submission={selectedSubmission} onBack={() => setSelectedSubmission(null)} strictMatches={findStrictMatches(selectedSubmission.cards)} onExport={onExport} debugMode={debugMode} setDebugMode={setDebugMode} normalizeForMatch={normalizeForMatch} normalizeNumber={normalizeNumber} buyList={buyList} notify={notify}/>
             )}
          </div>
        )}
        {tab === 'buylist' && (
          <div>
             <h2 className="text-2xl font-bold mb-6">Master Buy List</h2>
             <div className="bg-blue-50 border border-blue-200 p-6 rounded-lg mb-8">
                <h3 className="font-semibold text-blue-800 mb-2">Update Database</h3>
                <p className="text-sm text-blue-600 mb-4">Upload the latest CSV from Box.gg. This will overwrite the current comparison database.</p>
                <label className="inline-flex items-center bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 cursor-pointer transition">{isLoadingBuyList ? <span className="flex items-center"><Loader2 className="animate-spin mr-2" size={18}/> {uploadProgress || 'Processing...'}</span> : <span className="flex items-center"><Upload size={18} className="mr-2" /> Upload CSV</span>}<input type="file" accept=".csv" className="hidden" onChange={handleBuyListUpload} disabled={isLoadingBuyList} /></label>
             </div>
             <div className="border rounded-lg overflow-hidden">
                <div className="bg-gray-100 px-4 py-2 border-b font-medium text-sm text-gray-600 flex justify-between"><span>Current Database Preview</span><span>{buyList.length} entries loaded</span></div>
                <div className="max-h-[400px] overflow-y-auto p-4 text-sm">{buyList.length > 0 ? (<table className="min-w-full"><thead><tr className="text-left text-gray-500"><th>Name</th><th>Set</th><th>#</th><th>Cond.</th><th>Price</th></tr></thead><tbody>{buyList.map((item, i) => (<tr key={i} className="border-b border-gray-50"><td className="py-1">{item.name}</td><td className="py-1">{item.set}</td><td className="py-1">{item.number}</td><td className="py-1">{item.condition}</td><td className="py-1 text-green-600 font-medium">${item.price}</td></tr>))}</tbody></table>) : (<div className="text-center py-8 text-gray-400">No Buy List Data Found. Upload a CSV.</div>)}</div>
             </div>
          </div>
        )}
        {tab === 'settings' && (
           <div>
              <h2 className="text-2xl font-bold mb-6">Site Configuration</h2>
              <div className="space-y-6 max-w-xl">
                 <div><label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label><input className="w-full border p-2 rounded" value={settings.businessName} onChange={(e) => setSettings({...settings, businessName: e.target.value})} /></div>
                 <div><label className="block text-sm font-medium text-gray-700 mb-1">Promotional Text</label><input className="w-full border p-2 rounded" value={settings.promoText} onChange={(e) => setSettings({...settings, promoText: e.target.value})} /></div>
                 <div><label className="block text-sm font-medium text-gray-700 mb-1">Logo Image</label><div className="flex gap-4 items-center"><div className="w-16 h-16 bg-gray-100 rounded-lg border flex items-center justify-center overflow-hidden">{settings.logoUrl ? <img src={settings.logoUrl} className="w-full h-full object-contain"/> : <Database className="text-gray-400"/>}</div><label className="cursor-pointer bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded text-sm font-medium hover:bg-gray-50">Upload Logo<input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload}/></label></div></div>
                 <div><label className="block text-sm font-medium text-gray-700 mb-1">Banner Image URL</label><div className="flex gap-2"><input className="w-full border p-2 rounded" value={settings.bannerUrl} onChange={(e) => setSettings({...settings, bannerUrl: e.target.value})} /><div className="w-12 h-10 bg-gray-200 rounded overflow-hidden"><img src={settings.bannerUrl} className="w-full h-full object-cover" /></div></div></div>
                 <div className="border-t pt-4 mt-4"><label className="block text-sm font-bold text-gray-800 mb-2 flex items-center"><Sparkles size={16} className="mr-2 text-yellow-500"/> Hot Buys Slideshow</label><p className="text-xs text-gray-500 mb-3">Upload card images to display in the rotating slideshow on the home page.</p><div className="flex flex-wrap gap-4 mb-2">{settings.hotBuysImages?.map((img, idx) => (<div key={idx} className="relative w-24 h-32 border rounded-lg overflow-hidden bg-gray-100 shadow-sm group"><img src={img} className="w-full h-full object-contain" /><button onClick={() => handleRemoveHotBuyImage(idx)} className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md"><X size={12} /></button></div>))}<label className="w-24 h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-blue-50 hover:border-blue-300 text-gray-400 hover:text-blue-500 transition-colors"><Plus size={24} /><span className="text-xs mt-1 font-medium">Add Cards</span><input type="file" accept="image/*" multiple className="hidden" onChange={handleAddHotBuyImages} /></label></div></div>
                 <button onClick={() => handleUpdateSettings(settings)} className="bg-slate-800 text-white px-4 py-2 rounded hover:bg-slate-900 w-full">Save All Changes</button>
              </div>
           </div>
        )}
      </div>
    </div>
  );
}

function SubmissionDetail({ submission, onBack, strictMatches, onExport, debugMode, setDebugMode, normalizeForMatch, normalizeNumber, buyList, notify }) {
   const totalCards = submission.cards.length;
   const [status, setStatus] = useState(submission.status || 'pending');
   const [emailDraft, setEmailDraft] = useState('');
   const [isGenerating, setIsGenerating] = useState(false);
   const [collectionInsight, setCollectionInsight] = useState('');
   const [isAnalyzing, setIsAnalyzing] = useState(false);
   const [selectedIndices, setSelectedIndices] = useState(new Set());
   const [isRunningSmartMatch, setIsRunningSmartMatch] = useState(false);
   const [potentialMatches, setPotentialMatches] = useState({});

   const handleStatusChange = async (newStatus) => {
      setStatus(newStatus); 
      try { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'submissions', submission.id), { status: newStatus }); notify(`Status updated to ${newStatus}`); } 
      catch (error) { console.error("Failed to update status", error); notify("Failed to update status", "error"); setStatus(submission.status); }
   };

   const totalSelectedValue = useMemo(() => {
      let total = 0;
      selectedIndices.forEach(i => { const card = submission.cards[i]; const match = strictMatches[i] || potentialMatches[i]; if (match) { const price = parseFloat(match.price) || 0; const qty = parseInt(card.quantity) || 1; total += price * qty; } });
      return total.toFixed(2);
   }, [selectedIndices, strictMatches, potentialMatches, submission.cards]);

   const toggleSelection = (index) => { const newSet = new Set(selectedIndices); if (newSet.has(index)) newSet.delete(index); else newSet.add(index); setSelectedIndices(newSet); };
   const selectAllMatches = () => { const newSet = new Set(); submission.cards.forEach((_, i) => { if (strictMatches[i] || potentialMatches[i]) newSet.add(i); }); setSelectedIndices(newSet); };
   const handleExport = () => { if (selectedIndices.size === 0) { alert("Please select matches to export."); return; } const cardsToExport = submission.cards.filter((_, i) => selectedIndices.has(i)); onExport(cardsToExport, submission.customer.firstName); };

   const handleGenerateEmail = async () => {
      if (selectedIndices.size === 0) { alert("Please select cards to generate an offer for."); return; }
      setIsGenerating(true);
      const selectedData = Array.from(selectedIndices).map(i => { const card = submission.cards[i]; const match = strictMatches[i] || potentialMatches[i]; const price = parseFloat(match?.price || 0).toFixed(2); const qty = card.quantity || 1; return `- ${qty}x ${card.name} (${card.set}): $${price}/ea`; }).join('\\n');
      const prompt = `Write a friendly but professional email from "Broken TCG" to a customer named ${submission.customer.firstName}. Context: We reviewed their list and want to buy specific cards. Here is the list of cards we are offering to buy, including our buy prices: ${selectedData} Total Offer Amount: $${totalSelectedValue} Instructions: - Thank them for the submission. - Present the list clearly. - Mention the total offer price prominently. - Ask them to reply to confirm so we can send shipping instructions. - Keep it concise. - Do not include a subject line.`;
      try { const text = await callGemini(prompt); setEmailDraft(text); } catch (e) { alert("AI Error"); } finally { setIsGenerating(false); }
   };

   const handleAnalyzeCollection = async () => {
     setIsAnalyzing(true);
     const cardsList = submission.cards.map(c => `${c.quantity}x ${c.name} (${c.set})`).join(', ');
     const prompt = `Analyze this list of Pokemon cards and provide a 2-sentence summary of the collection's "vibe" for a store owner. Mention if it's mostly vintage, modern, high-value, or bulk. List: ${cardsList.substring(0, 2000)}...`;
     try { const text = await callGemini(prompt); setCollectionInsight(text); } catch(e) { alert("Analysis Failed"); } finally { setIsAnalyzing(false); }
   };

   const handleSmartMatch = async () => {
      setIsRunningSmartMatch(true);
      const newPotentials = {};
      try {
         const unmatchedIndices = submission.cards.map((c, i) => { const n = normalizeForMatch(c.name); const s = normalizeForMatch(c.set); const isStrictMatch = !!strictMatches[i]; return isStrictMatch ? null : { card: c, index: i }; }).filter(x => x !== null);
         for (const item of unmatchedIndices) {
             const { card, index } = item;
             const candidates = buyList.filter(b => { const bName = normalizeForMatch(b.name); const cName = normalizeForMatch(card.name); const bSet = normalizeForMatch(b.set); const cSet = normalizeForMatch(card.set); return (bName === cName) || (bSet === cSet) || (bName.includes(cName)) || (cName.includes(bName)); }).slice(0, 15); 
             if (candidates.length === 0) continue;
             const candidatesStr = candidates.map((c, idx) => `${idx}: ${c.name} | ${c.set} | $${c.price}`).join('\\n');
             const prompt = `I am matching Pokemon cards. Customer Card: "${card.name}" from set "${card.set}". Candidates: ${candidatesStr} Task: Identify if any candidate is the SAME card. - Focus primarily on NAME and SET. - IGNORE the Card Number unless it helps confirm a match. - Allow for differences like "Base Set 2" vs "Base Set II". If you find a match with >50% confidence, return ONLY the index number. If no match is found, return "-1".`;
             const resultText = await callGemini(prompt, "Return only the index number or -1.");
             const matchedIndex = parseInt(resultText.trim());
             if (!isNaN(matchedIndex) && matchedIndex !== -1 && candidates[matchedIndex]) { newPotentials[index] = candidates[matchedIndex]; }
         }
         setPotentialMatches(newPotentials);
         if(Object.keys(newPotentials).length > 0) { alert(`AI found ${Object.keys(newPotentials).length} possible matches!`); } else { alert("AI finished scan but found no confident matches for remaining cards."); }
      } catch (err) { console.error("AI Match Error", err); alert("AI Matching failed. Check console."); } finally { setIsRunningSmartMatch(false); }
   };

   return (
     <div className="animate-fade-in">
        <div className="flex justify-between items-center mb-4"><button onClick={onBack} className="text-gray-500 hover:text-gray-800 flex items-center text-sm"><X size={16} className="mr-1"/> Back to List</button><div className="flex items-center space-x-2"><span className="text-sm text-gray-500 font-medium">Set Status:</span><select value={status} onChange={(e) => handleStatusChange(e.target.value)} className="bg-white border border-gray-300 text-gray-700 text-sm rounded-md focus:ring-blue-500 focus:border-blue-500 block p-2"><option value="pending">Pending Review</option><option value="contacted">Contacted</option><option value="finalized">Finalized</option></select></div></div>
        <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 mb-6"><div className="flex justify-between items-start"><div><h1 className="text-2xl font-bold text-slate-800">{submission.customer.firstName}</h1><div className="mt-2 space-y-1 text-sm text-gray-600"><p className="flex items-center"><Mail size={14} className="mr-2"/> {submission.customer.email}</p><p className="flex items-center"><Phone size={14} className="mr-2"/> {submission.customer.phone || 'No phone'}</p></div></div><div className="text-right"><div className="text-3xl font-bold text-green-600">${totalSelectedValue}</div><div className="text-xs text-gray-500 uppercase font-bold">Total Offer Value</div><div className="text-xs text-gray-400 mt-1">{selectedIndices.size} Cards Selected</div></div></div></div>
        <div className="bg-white p-4 border border-purple-100 rounded-lg shadow-sm mb-6 flex flex-wrap gap-4 items-center"><span className="text-xs font-bold text-purple-500 uppercase flex items-center"><Sparkles size={14} className="mr-1"/> Actions:</span><button onClick={handleSmartMatch} disabled={isRunningSmartMatch} className="text-sm bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-1.5 rounded-md hover:opacity-90 font-bold transition flex items-center shadow-sm disabled:opacity-50">{isRunningSmartMatch ? <Loader2 className="animate-spin mr-2" size={14}/> : <BrainCircuit size={14} className="mr-2"/>}{isRunningSmartMatch ? 'Scanning...' : 'Run AI Smart Match'}</button><button onClick={handleGenerateEmail} className="text-sm bg-purple-50 text-purple-700 px-3 py-1.5 rounded-md hover:bg-purple-100 font-medium transition border border-purple-200 flex items-center">{isGenerating ? <Loader2 className="animate-spin mr-2" size={14}/> : <Mail size={14} className="mr-2"/>} Draft Offer Email</button><div className="ml-auto flex items-center gap-4"><button onClick={handleExport} className="bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded text-sm font-medium hover:bg-gray-50 flex items-center"><Download size={14} className="mr-2"/> Export TCG</button><button onClick={selectAllMatches} className="text-sm text-gray-600 hover:text-gray-900 font-medium">Select All Matches</button><div className="border-l pl-4"><label className="flex items-center text-xs font-bold text-gray-500 cursor-pointer"><input type="checkbox" className="mr-2" checked={debugMode} onChange={(e) => setDebugMode(e.target.checked)} /><Bug size={14} className="mr-1"/> Debug</label></div></div></div>
        {(emailDraft || collectionInsight) && (<div className="grid md:grid-cols-2 gap-4 mb-6">{emailDraft && (<div className="bg-purple-50 border border-purple-100 p-4 rounded-lg relative"><h4 className="text-xs font-bold text-purple-500 uppercase mb-2">Draft Email</h4><textarea className="w-full bg-transparent text-sm text-gray-700 focus:outline-none resize-y min-h-[100px]" value={emailDraft} onChange={(e) => setEmailDraft(e.target.value)} /><button onClick={() => setEmailDraft('')} className="absolute top-2 right-2 text-purple-300 hover:text-purple-600"><X size={14}/></button></div>)}{collectionInsight && (<div className="bg-indigo-50 border border-indigo-100 p-4 rounded-lg relative"><h4 className="text-xs font-bold text-indigo-500 uppercase mb-2">Collection Insight</h4><p className="text-sm text-gray-700 italic leading-relaxed">"{collectionInsight}"</p><button onClick={() => setCollectionInsight('')} className="absolute top-2 right-2 text-indigo-300 hover:text-indigo-600"><X size={14}/></button></div>)}</div>)}
        <div className="border rounded-lg overflow-hidden">
           <table className="min-w-full text-sm">
              <thead className="bg-gray-100 text-gray-600"><tr><th className="px-4 py-2 text-left w-10"></th><th className="px-4 py-2 text-left">Status</th><th className="px-4 py-2 text-left">Qty</th><th className="px-4 py-2 text-left">Card Name</th><th className="px-4 py-2 text-left">Set</th><th className="px-4 py-2 text-left">Number</th><th className="px-4 py-2 text-left">Condition</th><th className="px-4 py-2 text-left text-green-700 font-bold">Buy Price</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                 {submission.cards.map((card, i) => {
                    const n = normalizeForMatch(card.name); const s = normalizeForMatch(card.set); const key = `${n}|${s}`;
                    const strictMatch = strictMatches[i]; const aiMatch = potentialMatches[i]; const match = strictMatch || aiMatch; const hasMatch = !!match; const isSelected = selectedIndices.has(i);
                    return (
                       <React.Fragment key={i}>
                          <tr className={strictMatch ? 'bg-green-50/50' : aiMatch ? 'bg-yellow-50' : 'bg-white opacity-60'}>
                              <td className="px-4 py-2 text-center">{hasMatch && (<button onClick={() => toggleSelection(i)} className="text-blue-600">{isSelected ? <CheckSquare size={20}/> : <Square size={20}/>}</button>)}</td>
                              <td className="px-4 py-2">{strictMatch && <span className="text-green-600 font-bold flex items-center"><CheckCircle size={14} className="mr-1"/> MATCH</span>}{aiMatch && !strictMatch && (<div className="text-yellow-600 font-bold flex flex-col text-xs"><span className="flex items-center"><Sparkles size={14} className="mr-1"/> AI POSSIBLE:</span><span className="font-normal text-gray-500">{aiMatch.name}</span></div>)}{!hasMatch && <span className="text-gray-400">No Match</span>}</td>
                              <td className="px-4 py-2 font-bold">{card.quantity || 1}</td><td className="px-4 py-2 font-medium">{card.name}</td><td className="px-4 py-2">{card.set}</td><td className="px-4 py-2">{card.number}</td><td className="px-4 py-2">{card.condition}</td><td className="px-4 py-2 font-mono text-green-700 font-bold">{match ? `$${match.price}` : '-'}</td>
                           </tr>
                           {debugMode && (<tr className="bg-gray-50 text-xs font-mono text-gray-500"><td colSpan="8" className="px-4 py-1">DEBUG KEY: <span className="text-blue-600">{key}</span> {strictMatch ? '(STRICT)' : aiMatch ? '(AI)' : '(NONE)'}</td></tr>)}
                       </React.Fragment>
                    )
                 })}
              </tbody>
           </table>
        </div>
     </div>
   );
}
