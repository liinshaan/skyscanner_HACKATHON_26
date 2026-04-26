import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Sparkles, 
  ArrowRight, 
  Plane, 
  RotateCcw, 
  X,
  MapPin,
  Calendar,
  Compass,
  LayoutGrid,
  Search
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { geminiService, Destination } from './services/geminiService';
import { cn } from './lib/utils';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

type Step = 'setup' | 'generate' | 'matches';

interface DestinationCardProps {
  destination: Destination;
  idx: number;
  origin: string;
}

const DestinationCard: React.FC<DestinationCardProps> = ({ destination, idx, origin }) => {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.1 }}
      className="relative h-[480px] w-full [perspective:2000px] group cursor-pointer"
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <motion.div
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.8, type: "spring", stiffness: 100, damping: 20 }}
        className="relative w-full h-full [transform-style:preserve-3d]"
      >
        {/* Front Side: Image only */}
        <div className="absolute inset-0 w-full h-full [backface-visibility:hidden] rounded-[32px] overflow-hidden border border-white/5 shadow-2xl">
          <img 
            src={`https://source.unsplash.com/featured/?${encodeURIComponent(destination.imageKeyword || destination.name)}`} 
            alt={destination.name} 
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
          <div className="absolute bottom-8 left-8 right-8">
            <div className="px-4 py-1.5 bg-blue-600 border border-blue-400/30 rounded-full w-fit mb-3 shadow-[0_0_15px_rgba(37,99,235,0.4)]">
              <span className="text-[10px] font-bold text-white uppercase tracking-widest">Click to Reveal</span>
            </div>
            <h3 className="text-2xl font-bold text-white uppercase tracking-tight opacity-60">Result #{idx + 1}</h3>
          </div>
        </div>

        {/* Back Side: Details */}
        <div className="absolute inset-0 w-full h-full [backface-visibility:hidden] [transform:rotateY(180deg)] bg-[#0d0d0f] rounded-[32px] p-8 border border-blue-500/20 flex flex-col justify-between shadow-2xl overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-600/10 blur-[80px]" />
          
          <div className="space-y-6 relative z-10">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-blue-500 uppercase tracking-[0.4em] mb-1">{destination.country}</p>
                <h3 className="text-3xl font-bold text-white tracking-tighter uppercase leading-none">{destination.name}</h3>
              </div>
              <div className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[8px] font-bold text-slate-500 uppercase tracking-widest">SYS_REF_{idx + 1}</div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em]">Vision Match</span>
              <div className="flex items-baseline gap-2">
                <span className="text-7xl font-black text-white italic tracking-tighter leading-none bg-gradient-to-br from-white to-white/40 bg-clip-text text-transparent">
                  {destination.similarity}
                </span>
                <span className="text-2xl font-black text-blue-600">%</span>
              </div>
            </div>

            <p className="text-sm text-slate-400 leading-relaxed italic opacity-80 border-l-2 border-blue-500/30 pl-4 py-1">
              "{destination.description}"
            </p>
          </div>

          <div className="space-y-4 relative z-10">
            <div className="flex justify-between items-center bg-white/5 p-5 rounded-2xl border border-white/5 backdrop-blur-sm">
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Est. Travel Cost</p>
                <div className="flex items-center gap-2">
                  <Plane className="w-4 h-4 text-blue-500" />
                  <span className="text-3xl font-black text-white tracking-tighter italic">€{destination.estimatedPrice}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-bold text-slate-600 uppercase">From Origin</p>
                <p className="text-sm font-black text-blue-500 uppercase tracking-widest">{origin}</p>
              </div>
            </div>

            <a
              href={`https://www.skyscanner.com/transport/flights-from/${origin.toLowerCase()}/to/${destination.name.toLowerCase().replace(/\s+/g, '-')}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-2xl text-[10px] font-bold uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-3 shadow-2xl shadow-blue-500/30 group/btn"
            >
              Verify on Skyscanner <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
            </a>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default function App() {
  const [step, setStep] = useState<Step>('setup');
  const [destinationCount, setDestinationCount] = useState<string>('3');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [origin, setOrigin] = useState('MAD');
  const [departureDate, setDepartureDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [matches, setMatches] = useState<Destination[]>([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);

  // Recommendations logic
  useEffect(() => {
    if (keywords.length > 0) {
      geminiService.getRecommendations(keywords).then(setRecommendations);
    }
  }, [keywords]);

  const addKeyword = (word: string) => {
    const cleanWord = word.trim().toLowerCase();
    if (cleanWord && !keywords.includes(cleanWord)) {
      setKeywords([...keywords, cleanWord]);
    }
    setInputValue('');
  };

  const removeKeyword = (word: string) => {
    setKeywords(keywords.filter(k => k !== word));
  };

  const generateDream = async () => {
    if (keywords.length === 0) return;
    setIsGenerating(true);
    setStep('generate');

    const promptText = currentImage 
      ? `Taking the provided image as base, modify and evolve it to strongly incorporate these concepts: ${keywords.join(", ")}. Maintain visual continuity but update the scene according to the new keywords.`
      : `A cinematic, high-quality photograph of a travel destination described by these words: ${keywords.join(", ")}. Atmospheric, professional photography, realistic.`;

    try {
      const parts: any[] = [{ text: promptText }];
      
      if (currentImage) {
        const base64Data = currentImage.split(',')[1];
        parts.push({
          inlineData: {
            data: base64Data,
            mimeType: "image/png"
          }
        });
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: { role: 'user', parts },
      });

      const candidates = response.candidates;
      if (candidates && candidates.length > 0) {
        for (const part of candidates[0].content.parts) {
          if (part.inlineData) {
            setCurrentImage(`data:image/png;base64,${part.inlineData.data}`);
            break;
          }
        }
      }
    } catch (error) {
      console.error("Generation error:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const findMatches = async () => {
    setIsLoadingMatches(true);
    setStep('matches');
    try {
      const count = destinationCount === '4+' ? 5 : parseInt(destinationCount);
      const results = await geminiService.matchDestinations(keywords.join(", "), count, origin);
      setMatches(results);
    } catch (error) {
      console.error("Matching error:", error);
    } finally {
      setIsLoadingMatches(false);
    }
  };

  const reset = () => {
    setStep('setup');
    setKeywords([]);
    setCurrentImage(null);
    setMatches([]);
    setInputValue('');
  };

  return (
    <div className="min-h-screen bg-[#070708] text-slate-300 font-sans selection:bg-blue-500/30 overflow-hidden flex flex-col">
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-6 bg-[#070708] border-b border-white/5 relative z-20">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={reset}>
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center transition-transform group-hover:scale-105">
            <LayoutGrid className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">SkyVision <span className="text-[#3b82f6]">AI</span></span>
        </div>
        
        <div className="flex items-center gap-8">
          <button onClick={reset} className="text-xs font-bold uppercase tracking-widest text-blue-500 border-b-2 border-blue-500 pb-1">Discovery</button>
        </div>

        <div className="flex flex-col items-end">
          <span className="text-[8px] uppercase tracking-[0.2em] opacity-40 font-bold">POWERED BY</span>
          <span className="text-[10px] font-bold text-white tracking-widest">Skyscanner API</span>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-[300px] bg-[#070708] border-r border-white/5 p-6 space-y-6 overflow-y-auto relative z-10 shadow-2xl">
          {/* Section 1: Configuration */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">1. CONFIGURATION</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500 mb-2 block">ORIGIN (IATA)</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                  <input 
                    type="text" 
                    value={origin} 
                    onChange={(e) => setOrigin(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-xs font-bold text-white focus:outline-none focus:border-blue-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500 mb-2 block">DEPARTURE</label>
                <div className="relative">
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                  <input 
                    type="date" 
                    value={departureDate}
                    onChange={(e) => setDepartureDate(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-xs font-bold text-white focus:outline-none focus:border-blue-500/50 [color-scheme:dark]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500 mb-2 block">RETURN</label>
                <div className="relative">
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                  <input 
                    type="date" 
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-xs font-bold text-white focus:outline-none focus:border-blue-500/50 [color-scheme:dark]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500 mb-2 block">DESTINATIONS</label>
                <div className="flex gap-2">
                  {['1', '2', '3', '4+'].map(val => (
                    <button
                      key={val}
                      onClick={() => setDestinationCount(val)}
                      className={cn(
                        "flex-1 py-2 rounded-lg text-xs font-bold border transition-all",
                        destinationCount === val 
                          ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20" 
                          : "bg-white/5 border-white/5 text-slate-500 hover:bg-white/10"
                      )}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <hr className="border-white/5" />

          {/* Section 2: Refine Vision */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">2. REFINE VISION</h3>
            
            <div className="space-y-4">
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 min-h-[120px] flex flex-col">
                <div className="flex flex-wrap gap-2 mb-2">
                  {keywords.map(k => (
                    <span key={k} className="px-2 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-md text-[10px] font-bold flex items-center gap-1.5 uppercase tracking-wider">
                      {k}
                      <button onClick={() => removeKeyword(k)}><X className="w-2.5 h-2.5" /></button>
                    </span>
                  ))}
                </div>
                <textarea 
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword(inputValue))}
                  placeholder="Add words..."
                  className="flex-1 bg-transparent border-none text-xs text-white focus:ring-0 resize-none p-0 min-h-[60px]"
                />
              </div>

              {recommendations.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-blue-500/60">
                    <Sparkles className="w-3 h-3" />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {recommendations.slice(0, 6).map(r => (
                      <button 
                        key={r} 
                        onClick={() => addKeyword(r)}
                        className="px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/5 text-[9px] uppercase font-bold text-slate-500 rounded-lg transition-colors"
                      >
                        + {r}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-4 grid grid-cols-2 gap-3">
                <button
                  onClick={generateDream}
                  disabled={isGenerating || keywords.length === 0}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-[10px] font-bold uppercase tracking-widest py-4 rounded-xl transition-all shadow-xl shadow-blue-500/20 col-span-2"
                >
                  {isGenerating ? 'GENERATE_CORE...' : (currentImage ? 'REFINE VISION' : 'GENERATE VISION')}
                </button>
                
                {currentImage && (
                  <button
                    onClick={findMatches}
                    className="bg-white/5 hover:bg-white/10 text-white text-[10px] font-bold uppercase tracking-widest py-3 rounded-xl border border-white/10 transition-all flex items-center justify-center gap-2 col-span-2"
                  >
                    <Search className="w-3 h-3" /> Find Matches
                  </button>
                )}
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8 bg-[#070708] relative overflow-y-auto">
          <AnimatePresence mode="wait">
            {step === 'setup' && !currentImage ? (
              <motion.div 
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-full h-full border border-white/5 bg-[#0d0d0f] rounded-[32px] flex flex-col items-center justify-center text-center space-y-6"
              >
                <div className="w-16 h-16 bg-blue-600/10 rounded-2xl flex items-center justify-center border border-blue-500/20">
                  <Compass className="w-8 h-8 text-blue-500" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-white tracking-tight uppercase">Build Your Vision</h2>
                  <p className="text-sm text-slate-500 max-w-sm mx-auto uppercase tracking-widest leading-relaxed">
                    Add keywords on the left to start dreaming of your next escape.
                  </p>
                </div>
              </motion.div>
            ) : step === 'matches' ? (
              <motion.div 
                key="matches"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-8"
              >
                <div className="flex justify-between items-end border-b border-white/5 pb-6">
                  <div className="space-y-1">
                    <h2 className="text-4xl font-bold text-white uppercase tracking-tighter">Your Manifestations</h2>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.4em]">Synced via Neural_Engine 1.4</p>
                  </div>
                  <button onClick={reset} className="text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-white transition-colors">Start New Discovery</button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 px-4">
                  {isLoadingMatches ? (
                    [1, 2, 3].map(i => (
                      <div key={i} className="h-[480px] bg-white/5 rounded-[32px] animate-pulse relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
                      </div>
                    ))
                  ) : (
                    matches.map((destination, idx) => (
                      <DestinationCard 
                        key={destination.name} 
                        destination={destination} 
                        idx={idx} 
                        origin={origin}
                      />
                    ))
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="image"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-full h-full min-h-[600px] border border-white/5 bg-[#0d0d0f] rounded-[32px] overflow-hidden relative shadow-inner"
              >
                {isGenerating ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/40 backdrop-blur-sm z-30">
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-12 h-12 border-2 border-blue-600 border-t-transparent rounded-full shadow-[0_0_15px_rgba(37,99,235,0.4)]"
                    />
                    <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-blue-500">Manifesting Vision...</p>
                  </div>
                ) : currentImage ? (
                  <img src={currentImage} className="w-full h-full object-cover opacity-80" alt="Vision" />
                ) : null}
                
                {/* HUD Elements */}
                <div className="absolute top-8 left-8 flex gap-3 z-10">
                  <div className="px-4 py-2 bg-black/60 backdrop-blur-md border border-white/10 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 text-white/60">
                    <LayoutGrid className="w-3 h-3 text-blue-500" /> Layer: 01_Output
                  </div>
                  <div className="px-4 py-2 bg-black/60 backdrop-blur-md border border-white/10 rounded-xl text-[10px] font-bold uppercase tracking-widest text-[#3b82f6] shadow-lg shadow-blue-500/10">
                    Seed: 62901-AI
                  </div>
                </div>

                <div className="absolute bottom-8 left-8 right-8 z-10">
                  <div className="p-6 bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl flex justify-between items-center group">
                    <div className="space-y-1">
                      <p className="text-[9px] font-bold text-blue-500 uppercase tracking-widest">Active Core:</p>
                      <p className="text-lg font-bold text-white uppercase tracking-tight italic opacity-90">
                        {keywords.join(" • ")}
                      </p>
                    </div>
                    <div className="flex gap-2">
                       <button onClick={generateDream} className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all">
                          <RotateCcw className="w-5 h-5 text-slate-400" />
                       </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Taskbar Mimic or Simple Mobile Footer */}
      <footer className="h-6 bg-[#070708] border-t border-white/5 flex items-center justify-between px-6 px-1 lg:px-6 relative z-30">
        <div className="flex items-center gap-4 text-[9px] font-bold text-slate-600 uppercase tracking-[0.2em]">
           <span>Stable Distribution Mode</span>
           <span className="w-1 h-1 bg-green-500 rounded-full animate-pulse" />
           <span className="hidden md:inline">Latency: 240ms</span>
        </div>
        <div className="text-[9px] font-bold text-slate-600 uppercase tracking-[0.2em]">
           v3.9.2-build.release
        </div>
      </footer>
    </div>
  );
}
