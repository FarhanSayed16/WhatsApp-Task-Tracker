"use client";

import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Sparkles, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type { ParsedAITaskItem } from "@/lib/ai";

interface VoiceTaskInputProps {
  onTasksExtracted: (tasks: ParsedAITaskItem[]) => void;
  className?: string;
}

export function VoiceTaskInput({ onTasksExtracted, className }: VoiceTaskInputProps) {
  const [isSupported, setIsSupported] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const finalTranscriptRef = useRef("");

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US"; // Accepts multi-language if spoken clearly

      recognition.onresult = (event: any) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const piece = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscriptRef.current +=
              (finalTranscriptRef.current ? " " : "") + piece.trim();
          } else {
            interim += piece;
          }
        }
        const combined = [finalTranscriptRef.current, interim]
          .filter(Boolean)
          .join(" ")
          .trim();
        setTranscript(combined);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        if (event.error === "not-allowed") {
          setErrorMsg("Microphone access was denied. Please allow microphone permission in your browser.");
        } else {
          setErrorMsg(`Voice input error: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } catch (err) {
      console.warn("Speech recognition initialization failed:", err);
      setIsSupported(false);
    }
  }, []);

  const toggleListening = () => {
    setErrorMsg(null);
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      const full = (finalTranscriptRef.current || transcript).trim();
      if (full) {
        parseSpokenText(full);
      }
    } else {
      finalTranscriptRef.current = "";
      setTranscript("");
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error("Failed to start speech recognition:", err);
      }
    }
  };

  const parseSpokenText = async (textToParse: string) => {
    if (!textToParse.trim()) return;

    try {
      setIsParsing(true);
      const res = await fetch("/api/admin/ai/parse-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textToParse }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to parse spoken tasks");

      if (Array.isArray(json.data?.items) && json.data.items.length > 0) {
        onTasksExtracted(json.data.items);
        setTranscript("");
      }
    } catch (err: unknown) {
      console.error("Voice parse error:", err);
      setErrorMsg("Failed to extract tasks from speech. You can copy the transcript below.");
    } finally {
      setIsParsing(false);
    }
  };

  if (!isSupported) {
    return (
      <div className={cn("text-[11px] text-slate-400 flex items-center gap-1.5 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-800", className)}>
        <MicOff className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span>Voice dictation is not supported by your current browser.</span>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggleListening}
          disabled={isParsing}
          className={cn(
            "inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all shadow-sm",
            isListening
              ? "bg-rose-600 hover:bg-rose-500 text-white animate-pulse"
              : "bg-emerald-700 hover:bg-emerald-600 text-white"
          )}
        >
          {isListening ? (
            <>
              <MicOff className="w-3.5 h-3.5" />
              <span>Stop &amp; Extract Tasks</span>
            </>
          ) : (
            <>
              <Mic className="w-3.5 h-3.5" />
              <span>Speak Tasks</span>
            </>
          )}
        </button>

        {isListening && (
          <span className="inline-flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 font-semibold animate-pulse">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            Listening... Speak now
          </span>
        )}

        {isParsing && (
          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Extracting tasks…
          </span>
        )}
      </div>

      {errorMsg && (
        <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Live Transcript Display */}
      {transcript && (
        <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40 space-y-2 animate-slide-up">
          <div className="flex items-center justify-between text-[11px] text-emerald-900 dark:text-emerald-300 font-bold">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Live Transcript:
            </span>
            {!isListening && !isParsing && (
              <button
                type="button"
                onClick={() => parseSpokenText(transcript)}
                className="text-emerald-700 hover:text-emerald-900 underline font-semibold"
              >
                Parse Again
              </button>
            )}
          </div>
          <p className="text-xs text-slate-800 dark:text-slate-200 font-mono italic">
            &ldquo;{transcript}&rdquo;
          </p>
        </div>
      )}
    </div>
  );
}
