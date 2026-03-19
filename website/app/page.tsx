"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

declare global {
  interface Window {
    fbAsyncInit: () => void;
    FB: any;
  }
}

export default function Home() {
  const [status, setStatus] = useState<string>("Ready to connect");
  const [loading, setLoading] = useState<boolean>(false);
  const [isFbInitialized, setIsFbInitialized] = useState<boolean>(false);

  useEffect(() => {
    // Load Facebook SDK
    (function (d, s, id) {
      var js: any,
        fjs = d.getElementsByTagName(s)[0];
      if (d.getElementById(id)) return;
      js = d.createElement(s);
      js.id = id;
      js.src = "https://connect.facebook.net/en_US/sdk.js";
      fjs.parentNode?.insertBefore(js, fjs);
    })(document, "script", "facebook-jssdk");

    window.fbAsyncInit = function () {
      window.FB.init({
        appId: process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || "YOUR_APP_ID", // Replace with your App ID
        cookie: true,
        xfbml: true,
        version: "v22.0",
      });
      setIsFbInitialized(true);
      console.log("Facebook SDK Initialized");
    };
  }, []);

  const launchWhatsAppSignup = () => {
    if (!isFbInitialized) {
      setStatus("Facebook SDK is still loading, please wait...");
      return;
    }

    setLoading(true);
    setStatus("Opening Facebook Login...");

    window.FB.login(
      (response: any) => {
        if (response.authResponse) {
          const code = response.authResponse.code;
          setStatus("Connected! Exchanging code...");
          console.log("Authorization Code:", code);

          // Send code to backend
          sendCodeToBackend(code);
        } else {
          setStatus("Signup cancelled or failed.");
          setLoading(false);
        }
      },
      {
        config_id: process.env.NEXT_PUBLIC_CONFIG_ID || "YOUR_CONFIG_ID", // Replace with your Config ID
        response_type: "code",
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: "whatsapp_business_app_onboarding",
          sessionInfoVersion: "3",
        },
      }
    );
  };

  const sendCodeToBackend = async (code: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/auth/whatsapp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code }),
      });

      if (response.ok) {
        setStatus("WhatsApp connected successfully! Syncing data...");
      } else {
        const error = await response.json();
        setStatus(`Error: ${error.detail || "Failed to connect"}`);
      }
    } catch (err) {
      console.error(err);
      setStatus("Network error connecting to backend.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0d1117] text-white font-sans selection:bg-teal-500/30">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-teal-500/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px]"></div>
      </div>

      <main className="relative z-10 flex flex-col items-center max-w-2xl px-6 text-center">
        <div className="mb-8 p-4 bg-teal-500/10 rounded-2xl border border-teal-500/20 backdrop-blur-sm">
          <Image
            src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg"
            alt="WhatsApp Logo"
            width={60}
            height={60}
            className="drop-shadow-[0_0_15px_rgba(37,211,102,0.4)]"
          />
        </div>

        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
          WhatsApp Business Sync
        </h1>

        <p className="text-zinc-400 text-lg mb-10 max-w-lg leading-relaxed">
          Connect your WhatsApp Business App with our platform to enable seamless coexistence and automatic data synchronization.
        </p>

        <div className="flex flex-col items-center gap-6 w-full">
          <button
            onClick={launchWhatsAppSignup}
            disabled={loading || !isFbInitialized}
            className={`
              group relative flex items-center justify-center gap-3 px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-300
              ${loading || !isFbInitialized
                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700'
                : 'bg-white text-black hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(255,255,255,0.15)] active:scale-[0.98]'}
            `}
          >
            {loading && (
              <svg className="animate-spin h-5 w-5 text-zinc-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {loading ? "Connecting..." : !isFbInitialized ? "Loading SDK..." : "Connect WhatsApp Business"}
            {!loading && isFbInitialized && (
              <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            )}
          </button>

          <p className={`text-sm transition-colors duration-300 ${status.includes('Error') ? 'text-red-400' : 'text-zinc-500'}`}>
            {status}
          </p>
        </div>

        <div className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-8 text-left border-t border-zinc-800/50 pt-10">
          <div>
            <h3 className="text-white font-medium mb-1">Coexistence</h3>
            <p className="text-zinc-500 text-sm">Use your app and our platform simultaneously.</p>
          </div>
          <div>
            <h3 className="text-white font-medium mb-1">Instant Sync</h3>
            <p className="text-zinc-500 text-sm">Contacts and messages sync in real-time.</p>
          </div>
          <div>
            <h3 className="text-white font-medium mb-1">Secure</h3>
            <p className="text-zinc-500 text-sm">Direct integration using official Meta APIs.</p>
          </div>
        </div>
      </main>

      <footer className="mt-auto py-8 text-zinc-600 text-xs">
        © 2026 WhatsApp Business Sync Integration. All rights reserved.
      </footer>
    </div>
  );
}
