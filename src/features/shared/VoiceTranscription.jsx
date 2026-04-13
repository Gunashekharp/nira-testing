import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

export function VoiceTranscription({ onTranscript, language = "en-IN" }) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Speech recognition not supported in this browser. Try Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let final = "";
      let interim = "";
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript + " ";
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      if (final) {
        setTranscript((prev) => {
          const updated = prev + final;
          onTranscript?.(updated.trim());
          return updated;
        });
      }
      setInterimText(interim);
    };

    recognition.onerror = (event) => {
      setError(`Recognition error: ${event.error}`);
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
      setInterimText("");
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
    setError(null);
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setListening(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <motion.button
          onClick={listening ? stopListening : startListening}
          whileTap={{ scale: 0.95 }}
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-full transition-all shadow-soft",
            listening
              ? "bg-red-500 text-white animate-pulse shadow-red-200"
              : "bg-brand-midnight text-white hover:bg-brand-midnight/90"
          )}
        >
          {listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </motion.button>
        <div>
          <div className="text-sm font-semibold text-ink">
            {listening ? "Listening..." : "Voice Input"}
          </div>
          <div className="text-xs text-muted">
            {listening ? "Speak clearly — tap again to stop" : "Tap to start (English)"}
          </div>
        </div>
        {listening && <Loader2 className="h-4 w-4 animate-spin text-brand-tide ml-auto" />}
      </div>

      {(transcript || interimText) && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="rounded-xl border border-white/60 bg-white/80 p-4 shadow-soft"
        >
          <div className="text-xs font-medium text-muted mb-1">Transcript</div>
          <div className="text-sm text-ink leading-relaxed">
            {transcript}
            {interimText && <span className="text-muted/60 italic">{interimText}</span>}
          </div>
        </motion.div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-600">{error}</div>
      )}
    </div>
  );
}
