// src/pages/Home.tsx
import React from 'react';

const Home: React.FC = () => {
  return (
    <div className="relative min-h-screen bg-linear-to-br from-blue-600 via-indigo-700 to-purple-800 overflow-hidden">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(255,255,255,0.15)_0%,transparent_50%)]" />
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 py-12 text-center text-white">
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight mb-6 animate-fade-in">
          SwiftMall
        </h1>

        <p className="text-xl sm:text-2xl md:text-3xl font-light max-w-3xl mb-12 opacity-90 animate-fade-in animation-delay-300">
          Fast • Reliable • Proudly Kenyan
          <br className="sm:hidden" />
          <span className="text-blue-200 font-normal">Next-generation e-commerce</span>
        </p>

        <div className="flex flex-col sm:flex-row gap-6 md:gap-10 animate-fade-in animation-delay-500">
          <a
            href="/register"
            className="group relative px-10 py-5 bg-white text-blue-700 font-bold text-lg rounded-full shadow-2xl hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 hover:scale-105 overflow-hidden"
          >
            <span className="relative z-10">Get Started</span>
            <span className="absolute inset-0 bg-linear-to-r from-blue-100 to-white opacity-0 group-hover:opacity-30 transition-opacity duration-300" />
          </a>

          <a
            href="/login"
            className="group relative px-10 py-5 border-2 border-white/80 text-white font-bold text-lg rounded-full hover:bg-white/10 backdrop-blur-sm transition-all duration-300 transform hover:-translate-y-1 hover:scale-105"
          >
            Login
          </a>
        </div>

        <div className="mt-16 text-sm opacity-70">
          <p>Shopping made simple • Secure payments • Fast delivery across Kenya</p>
        </div>
      </div>
    </div>
  );
};

export default Home;