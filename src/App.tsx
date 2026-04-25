/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  MapPin, 
  Search, 
  Compass, 
  BarChart3, 
  Plane, 
  ArrowRight,
  Plus,
  RefreshCw,
  Clock,
  Loader2,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateTravelConcept, generateHeroImage, TravelConcept, Destination, generateKeywordSuggestions } from './services/geminiService';
import { getFlightPrice } from './services/skyscannerService';

const generateSkyscannerLink = (origin: string, dest: string, date: string) => {
  const d = new Date(date);
  const year = d.getFullYear().toString().slice(2);
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `https://www.skyscanner.es/transport/flights/${origin.toLowerCase()}/${dest.toLowerCase()}/${year}${month}${day}/`;
};

interface DestinationCardProps {
  dest: Destination;
  delay: number;
  origin: string;
  departureDate: string;
  key?: React.Key;
}

function DestinationCard({ dest, delay, origin, departureDate }: DestinationCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [destImage, setDestImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadImg() {
      // Stagger correctly: 2 seconds per card to respect free-tier Inference API limits
      await new Promise(resolve => setTimeout(resolve, delay * 2000 + 1000));
      
      try {
        const img = await generateHeroImage(dest.imagePrompt);
        if (isMounted) setDestImage(img);
      } catch (e) {
        console.error("Card Image Error:", e);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadImg();
    return () => { isMounted = false; };
  }, [dest.imagePrompt, delay]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="relative h-64 perspective-1000 cursor-pointer group"
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <motion.div
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.6, type: 'spring', stiffness: 260, damping: 20 }}
        className="w-full h-full relative preserve-3d"
      >
        {/* Front side (Image) */}
        <div className="absolute inset-0 backface-hidden bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 shadow-sm transition-all duration-500 hover:shadow-md">
          {loading ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Generating view...</p>
            </div>
          ) : destImage ? (
            <img 
              src={destImage} 
              className="w-full h-full object-cover grayscale-[20%] group-hover:grayscale-0 transition-all duration-700 group-hover:scale-110" 
              alt={dest.name}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-slate-50">
              <Compass className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Image unavailable</p>
            </div>
          )}
        </div>

        {/* Back side (Info) */}
        <div className="absolute inset-0 backface-hidden rotate-y-180 bg-white rounded-2xl p-5 border border-slate-200 shadow-xl flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <div className={`px-2 py-1 ${dest.matchPercentage > 90 ? 'bg-green-50 text-green-600 border-green-100' : 'bg-blue-50 text-blue-600 border-blue-100'} text-[10px] font-black rounded border uppercase tracking-wider`}>
              {dest.matchPercentage}% Match
            </div>
            <div className="flex flex-col items-end">
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-tighter">Budget Est.</span>
              <span className="text-slate-900 text-sm font-bold">€{dest.price}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 mb-1.5">
            <MapPin className="w-3 h-3 text-blue-600" />
            <h4 className="text-lg font-bold text-slate-900">{dest.name}</h4>
          </div>
          <p className="text-xs text-slate-500 line-clamp-3 mb-6 leading-relaxed">{dest.description}</p>
          <a 
            href={generateSkyscannerLink(origin, dest.iataCode, departureDate)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="mt-auto w-full py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-blue-500 transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-blue-600/20"
          >
            <Plane className="w-3 h-3" />
            Reserve Now
          </a>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function App() {
  const [origin, setOrigin] = useState('MAD');
  const [departureDate, setDepartureDate] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [returnDate, setReturnDate] = useState(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [accumulatedContext, setAccumulatedContext] = useState<string>('');
  const [scope, setScope] = useState(3);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [concept, setConcept] = useState<TravelConcept | null>(null);
  const [heroImage, setHeroImage] = useState<string | null>(null);
  const [showDestinations, setShowDestinations] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  const fetchSuggestions = async (currentKeywords: string[]) => {
    setSuggestionsLoading(true);
    try {
      const nextSuggestions = await generateKeywordSuggestions(currentKeywords);
      setSuggestions(nextSuggestions);
    } catch (e) {
      console.error(e);
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const handleRegenerate = async () => {
    if (keywords.length === 0) return;
    setLoading(true);
    setShowDestinations(false);
    try {
      const isModification = accumulatedContext.length > 0;
      const currentKeywords = keywords.join(", ");
      
      const newConcept = await generateTravelConcept(keywords, origin, departureDate, returnDate);
      setConcept(newConcept);

      // Update context state
      const nextContext = isModification ? `${accumulatedContext}, ${currentKeywords}` : currentKeywords;
      setAccumulatedContext(nextContext);
      
      // Gradually fetch real prices in the background
      const updatedDestinations = await Promise.all(
        newConcept.destinations.map(async (dest) => {
          const realPrice = await getFlightPrice(dest.iataCode, origin, new Date(departureDate));
          return realPrice ? { ...dest, price: realPrice } : dest;
        })
      );
      
      setConcept(prev => prev ? { ...prev, destinations: updatedDestinations } : null);

      // Pass current image and cumulative context to Hugging Face
      try {
        const img = await generateHeroImage(nextContext, heroImage || undefined);
        setHeroImage(img);
      } catch (imgError) {
        console.error("Hero image update failed:", imgError);
      }
    } catch (error) {
      console.error("Generation failed:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (keywords.length > 0 && !concept) {
      handleRegenerate();
    }
    fetchSuggestions(keywords);
  }, [keywords]);

  const addKeyword = (word: string) => {
    if (!keywords.includes(word)) {
      setKeywords([...keywords, word]);
    }
  };

  const removeKeyword = (word: string) => {
    setKeywords(keywords.filter(k => k !== word));
  };

  return (
    <div className="bg-slate-950 text-slate-200 font-sans min-h-screen flex flex-col selection:bg-blue-500/30">
      <style>{`
        .perspective-1000 { perspective: 1000px; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
      `}</style>
      
      {/* Header Navigation */}
      <header className="flex items-center justify-between px-8 h-16 border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-600/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">SkyVision <span className="text-blue-600 font-medium">AI</span></span>
        </div>
        
        <nav className="hidden md:flex gap-8 text-sm font-medium text-slate-400">
          <button className="text-blue-400 relative py-1">
            Discovery
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-400 rounded-full"></span>
          </button>
        </nav>

        <div className="flex items-center gap-4">
          <div className="h-8 w-[1px] bg-slate-200"></div>
          <div className="text-right hidden sm:block">
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Powered by</p>
            <p className="text-sm font-semibold text-slate-600">Skyscanner API</p>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row gap-6 p-6 max-w-[1600px] mx-auto w-full">
        {/* Control Panel */}
        <aside className="w-full lg:w-80 flex flex-col gap-6">
          <section className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-5 shadow-sm backdrop-blur-sm">
            <label className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-3 block">1. Configuration</label>
            <div className="space-y-4">
              <div>
                <p className="text-sm mb-2 font-medium text-white/60 uppercase tracking-tight text-[10px]">Origin (IATA)</p>
                <input 
                  type="text" 
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value.toUpperCase())}
                  placeholder="e.g. MAD, LHR, JFK"
                  className="w-full bg-white/30 border border-white/20 rounded-lg px-3 py-2 text-sm font-medium text-white outline-none focus:border-blue-500/50 transition-colors placeholder:text-white/40"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-sm mb-2 font-medium text-white/60 uppercase tracking-tight text-[10px]">Departure</p>
                  <input 
                    type="date" 
                    value={departureDate}
                    onChange={(e) => setDepartureDate(e.target.value)}
                    className="w-full bg-white/30 border border-white/20 rounded-lg px-2 py-2 text-[11px] font-medium text-white outline-none focus:border-blue-500/50 transition-colors"
                  />
                </div>
                <div>
                  <p className="text-sm mb-2 font-medium text-white/60 uppercase tracking-tight text-[10px]">Return</p>
                  <input 
                    type="date" 
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    className="w-full bg-white/30 border border-white/20 rounded-lg px-2 py-2 text-[11px] font-medium text-white outline-none focus:border-blue-500/50 transition-colors"
                  />
                </div>
              </div>
              <div>
                <p className="text-sm mb-2 font-medium text-white/60 uppercase tracking-tight text-[10px]">Destinations</p>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map((num) => (
                    <button 
                      key={num}
                      onClick={() => setScope(num)}
                      className={`py-2 rounded-lg text-sm font-medium transition-all ${
                        scope === num 
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                          : 'bg-slate-800/50 text-slate-500 hover:bg-slate-700/50 hover:text-slate-300'
                      }`}
                    >
                      {num === 4 ? '4+' : num}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-5 flex-1 flex flex-col shadow-sm backdrop-blur-sm">
            <label className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-3 block">2. Refine Vision</label>
            <div className="bg-white/30 border border-white/20 rounded-xl p-3 mb-4 min-h-[140px] flex flex-wrap gap-2 content-start focus-within:border-blue-500/50 transition-colors">
              {keywords.map((word) => (
                <span 
                  key={word} 
                  className="group px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full text-xs font-medium flex items-center gap-1.5 cursor-default"
                >
                  {word}
                  <button onClick={() => removeKeyword(word)} className="hover:text-blue-300 opacity-60 group-hover:opacity-100 uppercase text-[8px] font-bold">×</button>
                </span>
              ))}
              <input 
                type="text" 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && inputValue.trim()) {
                    addKeyword(inputValue.trim());
                    setInputValue('');
                  } else if (e.key === 'Backspace' && inputValue === '' && keywords.length > 0) {
                    removeKeyword(keywords[keywords.length - 1]);
                  }
                }}
                placeholder="Add words..." 
                className="bg-transparent border-none outline-none text-xs w-24 text-slate-300 placeholder:text-white/40"
              />
            </div>

            <p className="text-[10px] uppercase font-bold tracking-wider text-white/50 mb-3 ml-1">AI Suggestions</p>
            <div className="flex flex-wrap gap-2 mb-8 min-h-[40px]">
              {suggestionsLoading ? (
                <div className="flex items-center gap-2 px-2 py-1">
                  <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
                  <span className="text-[10px] text-white/40">Thinking...</span>
                </div>
              ) : (
                suggestions.map((suggestion) => (
                  <button 
                    key={suggestion}
                    onClick={() => addKeyword(suggestion)}
                    className="px-2.5 py-1.5 bg-slate-800/30 rounded-lg text-[10px] font-semibold border border-slate-700/50 hover:border-blue-500/50 hover:bg-slate-700/50 text-slate-400 hover:text-blue-400 transition-all flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    {suggestion}
                  </button>
                ))
              )}
            </div>

            <button 
              onClick={handleRegenerate}
              disabled={loading || keywords.length === 0}
              className="mt-auto w-full py-3.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Update Vision
            </button>
          </section>
        </aside>

        {/* Main Visual Area */}
        <div className="flex-1 flex flex-col gap-6">
          {/* AI Generated Image Canvas */}
          <div className="flex-1 min-h-[400px] bg-slate-800/30 rounded-3xl relative overflow-hidden group border border-slate-800/50 shadow-xl backdrop-blur-sm">
            {/* Background Image Layer */}
            {heroImage && (
              <div 
                className={`absolute inset-0 bg-cover bg-center transition-all duration-1000 ${loading ? 'opacity-30 blur-sm scale-110' : 'opacity-100'}`} 
                style={{ backgroundImage: `url('${heroImage}')` }}
                referrerPolicy="no-referrer"
              ></div>
            )}
            {!heroImage && !loading && (
              <div className="absolute inset-0 bg-gradient-to-br from-slate-800/50 to-slate-900/50 flex items-center justify-center p-12 text-center">
                <div className="max-w-xs">
                  <div className="w-16 h-16 bg-blue-600/10 text-blue-400 rounded-3xl border border-blue-500/20 flex items-center justify-center mx-auto mb-6 shadow-xl">
                    <Compass className="w-8 h-8 animate-pulse" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">Build Your Vision</h3>
                  <p className="text-white/60 text-sm">Add keywords on the left to start dreaming of your next escape.</p>
                </div>
              </div>
            )}
            
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center z-[5] bg-slate-950/40 backdrop-blur-sm">
                <div className="text-center">
                  <div className="inline-flex gap-2 mb-4">
                    <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce"></div>
                    <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce [animation-delay:0.2s]"></div>
                    <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce [animation-delay:0.4s]"></div>
                  </div>
                  <p className="text-blue-600 text-xs font-black tracking-widest uppercase">Rendering Dream...</p>
                </div>
              </div>
            )}

            {concept && !loading && !showDestinations && (
              <div className="absolute bottom-8 right-8 z-[10]">
                <button 
                  onClick={() => setShowDestinations(true)}
                  className="px-6 py-3 bg-white/90 backdrop-blur-md text-blue-600 rounded-2xl font-bold shadow-2xl hover:bg-blue-600 hover:text-white transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2 border border-slate-200"
                >
                  <MapPin className="w-4 h-4" />
                  Discover Destinations
                </button>
              </div>
            )}

            {/* Subtle overlay for contrast if needed at edges */}
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-slate-900/10 to-transparent"></div>
          </div>

          {/* Destination Results */}
          {showDestinations && (
            <div className="lg:h-72 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-700 pb-4">
              <div className="flex items-center justify-between mb-4 px-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">
                    {concept ? `${concept.destinations.length} Top Matches` : 'Top Matches'}
                  </h3>
                  <div className="h-0.5 w-8 bg-slate-200"></div>
                </div>
                <button 
                  onClick={() => setShowDestinations(false)}
                  className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-blue-600 transition-colors"
                >
                  Back to Vision
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1">
                {concept?.destinations.map((dest, i) => (
                  <DestinationCard 
                    key={i} 
                    dest={dest} 
                    delay={i * 0.1} 
                    origin={origin}
                    departureDate={departureDate}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer Status */}
      <footer className="px-8 py-3 border-t border-slate-800/50 flex flex-col sm:flex-row justify-between items-center bg-slate-950 gap-4 mt-auto">
        <div className="flex items-center gap-6 text-[10px] font-bold tracking-widest uppercase text-slate-500">
          <span className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.3)] ${loading ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`}></div> 
            AI Engine: {loading ? 'Processing' : 'Active'}
          </span>
          <span className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500/50"></div> 
            Service: Live
          </span>
        </div>
        <div className="text-[10px] text-slate-600 tracking-widest uppercase font-mono">
          SkyVision &copy; 2024
        </div>
      </footer>
    </div>
  );
}
