'use client'

import { useEffect, useState } from 'react'

interface AnimatedLogoProps {
  className?: string
}

export default function AnimatedLogo({ className = '' }: AnimatedLogoProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <div className={`animated-logo ${className}`}>
      {/* Main company name */}
      <div className="text-center mb-2">
        <h1 className="text-4xl font-bold tracking-tight drop-shadow-[0_8px_20px_rgba(7,12,34,0.45)]">
          <span className="inline-block">
            <span className="text-gradient animate-letter" style={{ animationDelay: '0s' }}>P</span>
            <span className="text-gradient">ci</span>
            <span className="text-gradient animate-letter" style={{ animationDelay: '0.2s' }}>N</span>
            <span className="text-gradient">et</span>
          </span>
        </h1>
        <p className="text-sm sm:text-base font-semibold uppercase tracking-[0.28em] text-[#CFE3FF] mt-3 drop-shadow-[0_4px_18px_rgba(3,8,24,0.85)]">
          <span className="text-gradient animate-letter" style={{ animationDelay: '0.4s' }}>C</span>
          <span className="text-[#CFE3FF]">OMPUTER </span>
          <span className="text-gradient animate-letter" style={{ animationDelay: '0.6s' }}>T</span>
          <span className="text-[#CFE3FF]">RADING & </span>
          <span className="text-gradient animate-letter" style={{ animationDelay: '0.8s' }}>S</span>
          <span className="text-[#CFE3FF]">ERVICES</span>
        </p>
      </div>

      {/* Animated PCTS subtitle */}
      <div className="text-center mt-4 mb-6">
        <div className="inline-flex items-center gap-1">
          <span className="pcts-letter pcts-p">P</span>
          <span className="pcts-letter pcts-c">C</span>
          <span className="pcts-letter pcts-t">T</span>
          <span className="pcts-letter pcts-s">S</span>
        </div>
      </div>

      <style jsx>{`
        .animated-logo {
          position: relative;
        }

        .text-gradient {
          background: linear-gradient(135deg, #5a7fff 0%, #7c64ff 45%, #a16eff 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          display: inline-block;
          text-shadow: 0 0 18px rgba(62, 104, 255, 0.45);
        }

        .animate-letter {
          animation: float 3s ease-in-out infinite;
          display: inline-block;
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
          }
          25% {
            transform: translateY(-10px) rotate(2deg);
          }
          50% {
            transform: translateY(0px) rotate(-2deg);
          }
          75% {
            transform: translateY(-5px) rotate(1deg);
          }
        }

        .pcts-letter {
          font-size: 2.5rem;
          font-weight: 800;
          display: inline-block;
          background: linear-gradient(135deg, #5a7fff 0%, #8f63ff 45%, #f093fb 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          position: relative;
          text-shadow: 0 0 25px rgba(72, 115, 255, 0.65);
        }

        .pcts-p {
          animation: bounce-p 2s ease-in-out infinite;
        }

        .pcts-c {
          animation: bounce-c 2s ease-in-out infinite;
          animation-delay: 0.15s;
        }

        .pcts-t {
          animation: bounce-t 2s ease-in-out infinite;
          animation-delay: 0.3s;
        }

        .pcts-s {
          animation: bounce-s 2s ease-in-out infinite;
          animation-delay: 0.45s;
        }

        @keyframes bounce-p {
          0%, 100% {
            transform: translateY(0px) scale(1);
          }
          25% {
            transform: translateY(-15px) scale(1.1);
          }
          50% {
            transform: translateY(0px) scale(1);
          }
        }

        @keyframes bounce-c {
          0%, 100% {
            transform: translateY(0px) scale(1) rotate(0deg);
          }
          25% {
            transform: translateY(-12px) scale(1.08) rotate(5deg);
          }
          50% {
            transform: translateY(0px) scale(1) rotate(0deg);
          }
        }

        @keyframes bounce-t {
          0%, 100% {
            transform: translateY(0px) scale(1);
          }
          25% {
            transform: translateY(-18px) scale(1.12);
          }
          50% {
            transform: translateY(0px) scale(1);
          }
        }

        @keyframes bounce-s {
          0%, 100% {
            transform: translateY(0px) scale(1) rotate(0deg);
          }
          25% {
            transform: translateY(-14px) scale(1.1) rotate(-5deg);
          }
          50% {
            transform: translateY(0px) scale(1) rotate(0deg);
          }
        }

        /* Performance optimization - use GPU acceleration */
        .animate-letter,
        .pcts-letter {
          will-change: transform;
          backface-visibility: hidden;
          -webkit-font-smoothing: antialiased;
        }

        /* Responsive sizing */
        @media (max-width: 640px) {
          .animated-logo h1 {
            font-size: 2rem;
          }
          .animated-logo p {
            font-size: 0.875rem;
          }
          .pcts-letter {
            font-size: 1.5rem;
          }
        }
      `}</style>
    </div>
  )
}
