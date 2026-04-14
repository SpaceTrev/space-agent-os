"use client";

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, Bot, ChevronRight, Play, Check } from 'lucide-react';
import { clsx } from 'clsx';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

// -----------------------------------------------------
// Utility: Noise Overlay
// -----------------------------------------------------
function NoiseOverlay() {
  return (
    <div className="pointer-events-none fixed inset-0 z-50 mix-blend-overlay">
      <svg className="absolute inset-0 h-full w-full opacity-[0.03]">
        <filter id="noiseFilter">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.65"
            numOctaves="3"
            stitchTiles="stitch"
          />
        </filter>
        <rect width="100%" height="100%" filter="url(#noiseFilter)" />
      </svg>
    </div>
  );
}

// -----------------------------------------------------
// Component A: NAVBAR
// -----------------------------------------------------
function Navbar() {
  const navRef = useRef<HTMLElement>(null);

  const [isScrolled, setIsScrolled] = useState(false);

  useGSAP(() => {
    ScrollTrigger.create({
      start: "top -50",
      end: 99999,
      onToggle: (self: any) => setIsScrolled(self.isActive),
      onUpdate: (self: any) => {
        if (self.direction === 1) {
          gsap.to(navRef.current, { y: -100, duration: 0.3, ease: 'power2.inOut' });
        } else {
          gsap.to(navRef.current, { y: 0, duration: 0.3, ease: 'power2.out' });
        }
      }
    });
  });

  return (
    <nav
      ref={navRef}
      className={clsx(
        "fixed top-4 left-1/2 -translate-x-1/2 z-40 w-[90%] max-w-5xl rounded-full border transition-colors duration-500 ease-out",
        isScrolled ? "bg-[#09090B]/80 backdrop-blur-md border-slate-800 shadow-xl" : "border-transparent text-slate-100"
      )}
    >
      <div className="flex h-14 items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600/20 text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
            <Bot className="h-4 w-4" />
          </div>
          <span className="text-sm font-bold tracking-tight text-slate-100">Agent OS</span>
        </Link>
        <div className="hidden md:flex items-center gap-6 text-sm text-slate-400 font-medium">
          <Link href="/mission-control" className="hover:text-slate-100 hover:-translate-y-[1px] transition-all">Mission Control</Link>
          <Link href="/marketplace" className="hover:text-slate-100 hover:-translate-y-[1px] transition-all">Marketplace</Link>
          <Link href="/agents" className="hover:text-slate-100 hover:-translate-y-[1px] transition-all">Agents</Link>
          <Link href="/dispatch" className="hover:text-slate-100 hover:-translate-y-[1px] transition-all">Dispatch</Link>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm text-slate-400 hover:text-slate-100 transition-colors hidden sm:block">
            Sign In
          </Link>
          <Link
            href="/mission-control"
            className="group relative overflow-hidden rounded-full bg-slate-800 px-5 py-2 text-sm font-medium text-slate-100 transition-transform hover:scale-[1.03]"
          >
            <span className="absolute inset-0 bg-indigo-600 translate-y-full transition-transform duration-300 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] group-hover:translate-y-0" />
            <span className="relative z-10">Get Started</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}

// -----------------------------------------------------
// Component B: HERO
// -----------------------------------------------------
function Hero() {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    
    tl.fromTo('.hero-badge', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, delay: 0.2 })
      .fromTo('.hero-title-1', { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8 }, "-=0.6")
      .fromTo('.hero-title-2', { y: 50, opacity: 0 }, { y: 0, opacity: 1, duration: 1 }, "-=0.6")
      .fromTo('.hero-desc', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8 }, "-=0.6")
      .fromTo('.hero-cta', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, stagger: 0.1 }, "-=0.6");
  }, { scope: containerRef });

  return (
    <section ref={containerRef} className="relative flex h-[100dvh] w-full items-center overflow-hidden bg-[#09090B]">
      {/* Background Image / Gradients */}
      <div className="absolute inset-0 z-0">
        <img
          src="https://images.unsplash.com/photo-1550751827-4bd374c3f58b?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80"
          alt="Cybernetic core"
          className="h-full w-full object-cover opacity-20 mix-blend-luminosity"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#09090B] via-[#09090B]/80 to-transparent" />
        <div className="absolute top-1/4 left-1/4 h-[500px] w-[500px] rounded-full bg-indigo-600/10 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 pt-32 lg:px-8">
        <div className="max-w-3xl">
          <div className="hero-badge mb-8 inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            Now in public beta
          </div>
          
          <h1 className="mb-6 flex flex-col font-bold tracking-tighter text-slate-100">
            <span className="hero-title-1 text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-sans mb-2">
              Agent OS is the
            </span>
            <span className="hero-title-2 text-6xl sm:text-7xl md:text-8xl lg:text-[7rem] italic text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-slate-200" style={{ fontFamily: 'Georgia, serif' }}>
              nervous system.
            </span>
          </h1>
          
          <p className="hero-desc text-lg sm:text-xl text-slate-400 max-w-xl mb-10 leading-relaxed">
            Deploy, orchestrate, and monitor AI agent teams across your organization. 
            A private command center for high-end AI orchestration.
          </p>
          
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/mission-control"
              className="hero-cta group relative overflow-hidden rounded-full bg-indigo-600 px-8 py-4 font-semibold text-white transition-transform hover:scale-[1.03]"
            >
              <span className="absolute inset-0 bg-indigo-500 translate-y-full transition-transform duration-300 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] group-hover:translate-y-0" />
              <span className="relative z-10 flex items-center gap-2">
                Get Started Free <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
            <Link
              href="#demo"
              className="hero-cta group flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/50 px-8 py-4 font-medium text-slate-200 backdrop-blur-sm transition-all hover:bg-slate-800 hover:text-white"
            >
              <Play className="h-4 w-4 fill-slate-400 group-hover:fill-slate-200 transition-colors" />
              View Demo
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// -----------------------------------------------------
// Feature Card: Shuffler
// -----------------------------------------------------
function FeatureShuffler() {
  const [models, setModels] = useState(['Claude 3.5 Sonnet', 'GPT-4o', 'Llama 3 70B']);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setModels(prev => {
        const _m = [...prev];
        _m.unshift(_m.pop()!);
        return _m;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative h-48 w-full overflow-hidden rounded-2xl border border-slate-800 bg-[#0c0c0e] p-6 shadow-2xl">
      <div className="mb-4 text-xs font-mono text-slate-500">ROUTING ENGINE</div>
      <div className="relative h-24 w-full perspective-[1000px]">
        {models.map((model, i) => {
          const isTop = i === 0;
          return (
            <div
              key={model}
              className={`absolute left-0 right-0 rounded-xl border p-3 transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                isTop 
                  ? 'border-indigo-500/30 bg-indigo-950/40 z-30 translate-y-0 scale-100 opacity-100 shadow-[0_8px_16px_rgba(99,102,241,0.1)]' 
                  : i === 1
                  ? 'border-slate-800 bg-slate-900/50 z-20 translate-y-4 scale-95 opacity-60'
                  : 'border-slate-800 bg-slate-900/30 z-10 translate-y-8 scale-90 opacity-20'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`font-medium ${isTop ? 'text-indigo-200' : 'text-slate-400'}`}>{model}</span>
                {isTop && <Check className="h-4 w-4 text-indigo-400" />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// -----------------------------------------------------
// Feature Card: Typewriter
// -----------------------------------------------------
function FeatureTypewriter() {
  const [text, setText] = useState('');
  const fullText = "SYSTEM ALIVE.\n> Connect to fleet...\n> Routing 4 tasks via GPT-4o\n> Token burn: 0.04$\n> Awaiting instructions_";
  
  useEffect(() => {
    let currentLength = 0;
    const interval = setInterval(() => {
      if (currentLength <= fullText.length) {
        setText(fullText.substring(0, currentLength));
        currentLength++;
      } else {
        setTimeout(() => { currentLength = 0; }, 4000);
      }
    }, 50);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative h-48 w-full overflow-hidden rounded-2xl border border-slate-800 bg-[#0c0c0e] p-6 shadow-2xl flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-mono text-slate-500">FLEET TELEMETRY</div>
        <div className="flex h-2 w-2 items-center justify-center">
          <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
        </div>
      </div>
      <div className="flex-1 rounded-xl bg-black/50 p-3 font-mono text-xs text-indigo-300 whitespace-pre leading-relaxed border border-slate-800/50">
        {text}
        <span className="animate-pulse">_</span>
      </div>
    </div>
  );
}

// -----------------------------------------------------
// Feature Card: Scheduler
// -----------------------------------------------------
function FeatureScheduler() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const cellRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const tl = gsap.timeline({ repeat: -1, repeatDelay: 1 });
    
    tl.set(cursorRef.current, { x: 150, y: 100, opacity: 0 })
      .set(cellRef.current, { backgroundColor: 'transparent' })
      .to(cursorRef.current, { opacity: 1, duration: 0.3 })
      .to(cursorRef.current, { x: 42, y: 35, duration: 1, ease: 'power2.inOut' })
      .to(cursorRef.current, { scale: 0.8, duration: 0.1 })
      .to(cellRef.current, { backgroundColor: 'rgba(99,102,241,0.2)', borderColor: 'rgba(99,102,241,0.5)', duration: 0.2 })
      .to(cursorRef.current, { scale: 1, duration: 0.1 })
      .to(cursorRef.current, { x: 200, y: 150, duration: 1, ease: 'power2.inOut' })
      .to(cursorRef.current, { opacity: 0, duration: 0.3 });
  }, { scope: containerRef });

  return (
    <div ref={containerRef} className="relative h-48 w-full overflow-hidden rounded-2xl border border-slate-800 bg-[#0c0c0e] p-6 shadow-2xl flex flex-col">
      <div className="text-xs font-mono text-slate-500 mb-4">APPROVAL WORKFLOW</div>
      <div className="grid grid-cols-7 gap-1 text-[10px] text-center font-mono text-slate-600 mb-2">
        <span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span>
      </div>
      <div className="grid grid-cols-7 gap-1 flex-1 relative">
        {Array.from({ length: 14 }).map((_, i) => (
          <div 
            key={i} 
            ref={i === 9 ? cellRef : null}
            className={`rounded-md border border-slate-800/50 bg-slate-900/40 ${i === 9 ? 'transition-colors' : ''}`}
          ></div>
        ))}
        {/* Cursor */}
        <div ref={cursorRef} className="absolute z-10 drop-shadow-lg w-4 h-4 text-white">
          <svg viewBox="0 0 24 24" fill="currentColor" stroke="black" strokeWidth="1" className="w-5 h-5 -rotate-12">
            <path d="M5.5 2 L19 12 L11 13 L15 21 L12 22 L8 14 L2 16 Z" />
          </svg>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------
// Component C: FEATURES
// -----------------------------------------------------
function Features() {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    gsap.from('.feature-col', {
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'top 70%',
      },
      y: 50,
      opacity: 0,
      stagger: 0.15,
      duration: 1,
      ease: 'power3.out'
    });
  }, { scope: containerRef });

  return (
    <section id="features" ref={containerRef} className="py-32 px-6 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Col 1 */}
        <div className="feature-col flex flex-col gap-6">
          <FeatureShuffler />
          <div>
            <h3 className="text-xl font-bold text-slate-100 mb-2">Model-Agnostic Routing</h3>
            <p className="text-slate-400 leading-relaxed text-sm">
              Isolate workspaces and hot-swap between Claude, OpenAI, or local weights mid-sprint without rewriting agents.
            </p>
          </div>
        </div>

        {/* Col 2 */}
        <div className="feature-col flex flex-col gap-6">
          <FeatureTypewriter />
          <div>
            <h3 className="text-xl font-bold text-slate-100 mb-2">Fleet Observability</h3>
            <p className="text-slate-400 leading-relaxed text-sm">
              Real-time log streams, granular token economics, and compute provisioning in a single pane of glass.
            </p>
          </div>
        </div>

        {/* Col 3 */}
        <div className="feature-col flex flex-col gap-6">
          <FeatureScheduler />
          <div>
            <h3 className="text-xl font-bold text-slate-100 mb-2">Human-in-the-Loop Sprints</h3>
            <p className="text-slate-400 leading-relaxed text-sm">
              Orchestrate complex tasks with mandatory milestone approvals before completion, ensuring complete control.
            </p>
          </div>
        </div>

      </div>
    </section>
  );
}

// -----------------------------------------------------
// Component D: PHILOSOPHY
// -----------------------------------------------------
function Philosophy() {
  const containerRef = useRef<HTMLElement>(null);

  useGSAP(() => {
    gsap.to('.parallax-bg', {
      y: '20%',
      ease: 'none',
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'top bottom',
        end: 'bottom top',
        scrub: true
      }
    });

    gsap.from('.phil-text', {
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'top 60%',
      },
      y: 40,
      opacity: 0,
      stagger: 0.2,
      duration: 1,
      ease: 'power3.out'
    });
  }, { scope: containerRef });

  return (
    <section ref={containerRef} className="relative py-48 overflow-hidden bg-[#050508] border-y border-slate-800">
      <div className="absolute inset-0 z-0">
        <img
          src="https://images.unsplash.com/photo-1558494949-ef010cbdcc31?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80"
          alt="Server infrastructure"
          className="parallax-bg h-[120%] w-full object-cover opacity-10 mix-blend-screen"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#050508] via-transparent to-[#050508]" />
      </div>
      
      <div className="relative z-10 max-w-5xl mx-auto px-6 text-center flex flex-col items-center justify-center">
        <p className="phil-text text-xl md:text-2xl text-slate-400 mb-6 font-medium tracking-tight">
          Most agent frameworks focus on scripts and terminal logs.
        </p>
        <p className="phil-text text-4xl md:text-5xl lg:text-7xl font-sans tracking-tight text-white flex flex-col items-center gap-2">
          <span>We focus on</span>
          <span className="italic text-indigo-400 mt-2" style={{ fontFamily: 'Georgia, serif' }}>
            production orchestration.
          </span>
        </p>
      </div>
    </section>
  );
}

// -----------------------------------------------------
// Component E: PROTOCOL (Sticky Stacking)
// -----------------------------------------------------
const PROTOCOL_STEPS = [
  {
    num: "01",
    title: "Deploy",
    desc: "Define your agent swarm. Abstract models into unified multi-tenant workspaces.",
    graphic: (
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-64 h-64 border border-indigo-500/20 rounded-full flex items-center justify-center animate-[spin_20s_linear_infinite]">
        <div className="w-48 h-48 border border-indigo-500/30 rounded-full flex items-center justify-center border-dashed">
          <div className="w-32 h-32 bg-indigo-500/10 rounded-full blur-xl"></div>
        </div>
      </div>
    )
  },
  {
    num: "02",
    title: "Orchestrate",
    desc: "Manage sprints and human approvals via an integrated task board and scheduler.",
    graphic: (
      <div className="absolute right-10 top-1/2 -translate-y-1/2 w-64 h-48 border border-slate-700 rounded-xl overflow-hidden bg-slate-900/50">
        <div className="absolute inset-0 bg-[linear-gradient(transparent_0%,rgba(99,102,241,0.2)_50%,transparent_100%)] h-[10px] w-full animate-[scan_3s_linear_infinite]" style={{ animationName: 'spin' }} />
        <div className="w-full h-full flex flex-col gap-2 p-4">
          <div className="h-4 w-3/4 rounded bg-slate-800"></div>
          <div className="h-4 w-1/2 rounded bg-slate-800"></div>
          <div className="h-4 w-5/6 rounded bg-slate-800"></div>
        </div>
      </div>
    )
  },
  {
    num: "03",
    title: "Observe",
    desc: "Scale compute, monitor costs, and analyze exact token traces in real-time.",
    graphic: (
      <div className="absolute right-10 top-1/2 -translate-y-1/2 w-64 h-32 flex items-center justify-center">
        <svg viewBox="0 0 200 100" className="w-full h-full stroke-indigo-500 fill-none" strokeWidth="2">
          <path d="M0,50 L40,50 L50,20 L60,80 L70,50 L200,50" className="opacity-50" />
          <path d="M0,50 L40,50 L50,20 L60,80 L70,50 L200,50" strokeDasharray="300" strokeDashoffset="300" style={{ animation: 'dash 3s linear infinite' }} />
        </svg>
        <style>{`
          @keyframes dash {
            to { stroke-dashoffset: 0; }
          }
        `}</style>
      </div>
    )
  }
];

function Protocol() {
  const containerRef = useRef<HTMLElement>(null);

  useGSAP(() => {
    const cards = gsap.utils.toArray('.protocol-card') as HTMLElement[];
    
    cards.forEach((card: HTMLElement, index: number) => {
      ScrollTrigger.create({
        trigger: card,
        start: "top top+=100",
        endTrigger: containerRef.current,
        end: "bottom bottom",
        pin: true,
        pinSpacing: false,
        scrub: 1,
      });

      // Animate previous cards down when new card rolls in
      if (index > 0) {
        gsap.to(cards[index - 1], {
          scale: 0.9,
          opacity: 0.3,
          filter: "blur(10px)",
          scrollTrigger: {
            trigger: card,
            start: "top bottom",
            end: "top top+=100",
            scrub: 1,
          }
        });
      }
    });

  }, { scope: containerRef });

  return (
    <section id="protocol" ref={containerRef} className="relative py-32 bg-[#09090B]">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-24">
          <h2 className="text-sm font-mono text-indigo-400 mb-4 tracking-widest">PROTOCOL</h2>
          <p className="text-3xl lg:text-5xl font-bold tracking-tight text-white">The Swarm Operation Model</p>
        </div>

        <div className="relative pb-[50vh]">
          {PROTOCOL_STEPS.map((step, i) => (
            <div 
              key={step.num}
              className={`protocol-card relative w-full h-[60vh] max-h-[500px] mb-8 bg-[#111116] border border-slate-800 rounded-[2rem] p-12 overflow-hidden shadow-2xl flex items-center z-[${i*10}]`}
            >
              <div className="w-1/2 relative z-10">
                <span className="font-mono text-5xl font-black text-slate-800 mb-6 block">{step.num}</span>
                <h3 className="text-4xl font-bold text-white mb-4">{step.title}</h3>
                <p className="text-lg text-slate-400 leading-relaxed max-w-sm">{step.desc}</p>
              </div>
              <div className="w-1/2 relative h-full hidden md:block">
                {step.graphic}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// -----------------------------------------------------
// Component F: PRICING
// -----------------------------------------------------
function Pricing() {
  return (
    <section id="pricing" className="py-32 px-6 max-w-7xl mx-auto">
      <div className="text-center mb-20">
        <h2 className="text-3xl lg:text-5xl font-bold tracking-tight text-white mb-4">Pricing that scales with you</h2>
        <p className="text-slate-400 max-w-xl mx-auto">No hidden fees. Full access to the orchestrator.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center max-w-5xl mx-auto">
        {/* Tier 1 */}
        <div className="rounded-[2rem] border border-slate-800 bg-[#0c0c0e] p-8 text-center flex flex-col">
          <h3 className="text-xl font-bold text-slate-200 mb-2">Starter</h3>
          <p className="text-4xl font-bold text-white mb-6">$0<span className="text-lg text-slate-500 font-normal">/mo</span></p>
          <ul className="text-sm text-slate-400 space-y-3 mb-8 text-left">
            <li className="flex items-center gap-2"><Check className="h-4 w-4 text-indigo-400" /> 1 Workspace</li>
            <li className="flex items-center gap-2"><Check className="h-4 w-4 text-indigo-400" /> Basic Models</li>
            <li className="flex items-center gap-2"><Check className="h-4 w-4 text-indigo-400" /> Community Support</li>
          </ul>
          <Link href="/mission-control" className="mt-auto block w-full rounded-full border border-slate-700 bg-transparent py-3 text-sm font-semibold text-white hover:bg-slate-800 transition-colors">Start Free</Link>
        </div>

        {/* Tier 2 (Pops) */}
        <div className="rounded-[2rem] border border-indigo-500/50 bg-[#12121a] p-10 text-center relative shadow-[0_0_40px_rgba(99,102,241,0.15)] transform md:scale-105 z-10 flex flex-col pt-12">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-b-lg">MOST POPULAR</div>
          <h3 className="text-xl font-bold text-indigo-300 mb-2">Pro</h3>
          <p className="text-4xl font-bold text-white mb-6">$49<span className="text-lg text-slate-500 font-normal">/mo</span></p>
          <ul className="text-sm text-slate-300 space-y-3 mb-8 text-left">
            <li className="flex items-center gap-2"><Check className="h-4 w-4 text-indigo-400" /> Unlimited Workspaces</li>
            <li className="flex items-center gap-2"><Check className="h-4 w-4 text-indigo-400" /> Any Model Support</li>
            <li className="flex items-center gap-2"><Check className="h-4 w-4 text-indigo-400" /> Approval Workflows</li>
            <li className="flex items-center gap-2"><Check className="h-4 w-4 text-indigo-400" /> Metric Telemetry</li>
          </ul>
          <Link href="/mission-control" className="mt-auto group relative overflow-hidden rounded-full bg-indigo-600 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.03]">
            <span className="absolute inset-0 bg-indigo-500 translate-y-full transition-transform duration-300 ease-out group-hover:translate-y-0" />
            <span className="relative z-10">Get Pro</span>
          </Link>
        </div>

        {/* Tier 3 */}
        <div className="rounded-[2rem] border border-slate-800 bg-[#0c0c0e] p-8 text-center flex flex-col">
          <h3 className="text-xl font-bold text-slate-200 mb-2">Enterprise</h3>
          <p className="text-4xl font-bold text-white mb-6">Custom</p>
          <ul className="text-sm text-slate-400 space-y-3 mb-8 text-left">
            <li className="flex items-center gap-2"><Check className="h-4 w-4 text-indigo-400" /> Dedicated Compute</li>
            <li className="flex items-center gap-2"><Check className="h-4 w-4 text-indigo-400" /> SLA Guaranteed</li>
            <li className="flex items-center gap-2"><Check className="h-4 w-4 text-indigo-400" /> 24/7 Phone Support</li>
          </ul>
          <Link href="/contact" className="mt-auto block w-full rounded-full border border-slate-700 bg-transparent py-3 text-sm font-semibold text-white hover:bg-slate-800 transition-colors">Contact Sales</Link>
        </div>
      </div>
    </section>
  );
}

// -----------------------------------------------------
// Component G: FOOTER
// -----------------------------------------------------
function Footer() {
  return (
    <footer className="mt-20 border-t border-slate-800 bg-[#050508] py-12 rounded-t-[4rem]">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="col-span-1 md:col-span-2">
          <Link href="/" className="flex items-center gap-2 mb-4">
            <Bot className="h-5 w-5 text-indigo-500" />
            <span className="font-bold tracking-tight text-white">Agent OS</span>
          </Link>
          <p className="text-sm text-slate-500 max-w-xs mb-8">
            The operating system for AI-powered teams. Deploy, orchestrate, and monitor AI agent teams.
          </p>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-900 border border-slate-800">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-mono text-slate-400 font-medium">System Operational</span>
          </div>
        </div>
        
        <div>
          <h4 className="font-bold text-slate-200 mb-4 text-sm">Product</h4>
          <ul className="space-y-2 text-sm text-slate-500">
            <li><Link href="#" className="hover:text-indigo-400 transition-colors">Features</Link></li>
            <li><Link href="#" className="hover:text-indigo-400 transition-colors">Integrations</Link></li>
            <li><Link href="#" className="hover:text-indigo-400 transition-colors">Pricing</Link></li>
            <li><Link href="#" className="hover:text-indigo-400 transition-colors">Changelog</Link></li>
          </ul>
        </div>
        
        <div>
          <h4 className="font-bold text-slate-200 mb-4 text-sm">Company</h4>
          <ul className="space-y-2 text-sm text-slate-500">
            <li><Link href="#" className="hover:text-indigo-400 transition-colors">About</Link></li>
            <li><Link href="#" className="hover:text-indigo-400 transition-colors">Careers</Link></li>
            <li><Link href="#" className="hover:text-indigo-400 transition-colors">Legal</Link></li>
            <li><Link href="#" className="hover:text-indigo-400 transition-colors">Contact</Link></li>
          </ul>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 mt-12 pt-8 border-t border-slate-800/50 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-600">
        <p>&copy; {new Date().getFullYear()} Agent OS Inc. All rights reserved.</p>
        <div className="flex gap-4">
          <Link href="#" className="hover:text-slate-400 text-slate-600 font-mono">X/Twitter</Link>
          <Link href="#" className="hover:text-slate-400 text-slate-600 font-mono">GitHub</Link>
          <Link href="#" className="hover:text-slate-400 text-slate-600 font-mono">LinkedIn</Link>
        </div>
      </div>
    </footer>
  );
}

// -----------------------------------------------------
// MAIN EXPORT
// -----------------------------------------------------
export default function CinematicLandingPage() {
  return (
    <div className="relative min-h-screen bg-[#09090B] text-slate-100 selection:bg-indigo-500/30 font-sans overflow-x-hidden">
      <NoiseOverlay />
      <Navbar />
      <main>
        <Hero />
        <Features />
        <Philosophy />
        <Protocol />
        <Pricing />
      </main>
      <Footer />
    </div>
  );
}
