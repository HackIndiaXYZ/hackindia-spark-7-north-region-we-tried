"use client";

import { useState, useEffect, useRef, useCallback, memo, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { Send, Bot, User, CheckCircle, Video, VideoOff, Mic, MicOff, Clock, ShieldOff, Home, Timer, MessageSquare, ChevronLeft, ChevronRight } from "lucide-react";
import { MAX_QUESTION_COUNT, CHAT_QUESTION_COUNT, INTERVIEW_DURATION_SECONDS, ANSWER_TIME_LIMIT_SECONDS, THINKING_DELAY_MS, INTERVIEW_PHASES, getCurrentPhase, type InterviewPhase } from "@/lib/interview-config";
import { CODING_LANGUAGES, CODING_QUESTIONS, CODING_QUESTIONS_BY_ROLE, CodingLanguage } from "@/lib/coding-round";

const MAX_RECORDING_SECONDS = 180; // 3-minute max
const CODING_ROUND_SECONDS = 30 * 60; // 30 minutes
const MAX_CHEAT_WARNINGS = 2;

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

type Message = {
  id: string;
  role: "user" | "model";
  text: string;
  hasVideo?: boolean;
  timestamp?: number;
  isFollowUp?: boolean;
  isVoice?: boolean;
};

type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript?: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
};

/** Memoized single chat message — only re-renders when its own props change */
const ChatMessage = memo(function ChatMessage({ msg }: { msg: Message }) {
  return (
    <div
      className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
      style={{ opacity: 1 }}
    >
      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
        msg.role === "user" ? "bg-blue-500/20 text-blue-400" : "bg-indigo-500/20 text-indigo-400"
      }`}>
        {msg.role === "user" ? (msg.isVoice ? <Mic size={12} /> : <User size={12} />) : <Bot size={12} />}
      </div>
      <div className="max-w-[75%]">
        {msg.role === "user" && msg.isVoice && (
          <div className={`flex items-center gap-1 mb-1 ${msg.role === "user" ? "justify-end" : ""}`}>
            <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/20">
              <Mic size={8} /> Voice Response
            </span>
          </div>
        )}
        <div className={`rounded-xl px-3.5 py-2 text-[13px] leading-relaxed ${
          msg.role === "user"
            ? "bg-blue-600 text-white rounded-tr-none"
            : "bg-slate-800/80 text-slate-200 border border-slate-700/50 rounded-tl-none"
        }`}>
          <p className="whitespace-pre-wrap">{msg.text}</p>
        </div>
        {msg.timestamp && (
          <p className={`text-[9px] mt-0.5 ${msg.role === "user" ? "text-right" : ""} text-slate-600`}>
            {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
      </div>
    </div>
  );
});

/** Memoized message list — only re-renders when messages array changes */
const ChatMessageList = memo(function ChatMessageList({
  messages,
  isThinking,
  loading,
}: {
  messages: Message[];
  isThinking: boolean;
  loading: boolean;
}) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <>
      {messages.map((msg) => (
        <ChatMessage key={msg.id} msg={msg} />
      ))}
      {/* Thinking indicator */}
      {isThinking && (
        <div className="flex gap-2.5">
          <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Bot size={12} />
          </div>
          <div className="bg-slate-800/80 border border-slate-700/50 rounded-xl rounded-tl-none px-3.5 py-2.5">
            <p className="text-[11px] text-amber-300/80 italic">Reviewing your answer...</p>
          </div>
        </div>
      )}
      {/* Typing indicator (streaming) */}
      {loading && !isThinking && (
        <div className="flex gap-2.5">
          <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Bot size={12} />
          </div>
          <div className="bg-slate-800/80 border border-slate-700/50 rounded-xl rounded-tl-none px-3.5 py-2 flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" />
            <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: "0.15s" }} />
            <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: "0.3s" }} />
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </>
  );
});

export default function InterviewPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [interviewStatus, setInterviewStatus] = useState<"PENDING" | "IN_PROGRESS" | "COMPLETED">("PENDING");
  const [finalSummary, setFinalSummary] = useState("");
  const [cameraOn, setCameraOn] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcriptDraft, setTranscriptDraft] = useState("");
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [lastUploadedVideoUrl, setLastUploadedVideoUrl] = useState("");
  const [videoUploadError, setVideoUploadError] = useState("");
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [isVideoSavedForAnswer, setIsVideoSavedForAnswer] = useState(false);
  const [roleTemplate, setRoleTemplate] = useState<string>("FULLSTACK");
  const [codingRoundStarted, setCodingRoundStarted] = useState(false);
  const [showCodingCaution, setShowCodingCaution] = useState(false);
  const [codingRoundCompleted, setCodingRoundCompleted] = useState(false);
  const [cultureRoundStarted, setCultureRoundStarted] = useState(false);
  const [cultureResponses, setCultureResponses] = useState({
    fastPaced: 3,
    collaboration: 3,
    adaptability: 3,
    location: "Hybrid"
  });
  const [selectedCodingLanguage, setSelectedCodingLanguage] = useState<CodingLanguage>("javascript");
  
  // These will be properly initialized in the useEffect when role is fetched
  const [activeQuestions, setActiveQuestions] = useState<typeof CODING_QUESTIONS>([]);
  const [activeQuestionIds, setActiveQuestionIds] = useState<string[]>([]);
  const [currentCodingQuestionIndex, setCurrentCodingQuestionIndex] = useState(0);
  const [questionCompletion, setQuestionCompletion] = useState<boolean[]>([]);
  const [codingSubmissions, setCodingSubmissions] = useState<Array<{
    questionId: string;
    title: string;
    language: string;
    code: string;
    passed: number;
    total: number;
  }>>([]);
  const [codingTimeLeft, setCodingTimeLeft] = useState(CODING_ROUND_SECONDS);
  const [codingCode, setCodingCode] = useState("");
  const [runInput, setRunInput] = useState("");
  const [runLoading, setRunLoading] = useState(false);
  const [runOutput, setRunOutput] = useState("");
  const [codingRunLoading, setCodingRunLoading] = useState(false);
  const [codingSubmitLoading, setCodingSubmitLoading] = useState(false);
  const [codingError, setCodingError] = useState("");
  const [cheatWarnings, setCheatWarnings] = useState(0);
  const [antiCheatLogs, setAntiCheatLogs] = useState<string[]>([]);
  const [isFullscreenActive, setIsFullscreenActive] = useState(false);
  const [isAutoSubmitting, setIsAutoSubmitting] = useState(false);
  const [autoSubmitReason, setAutoSubmitReason] = useState<string | null>(null);
  const [codingRoundSummary, setCodingRoundSummary] = useState<{
    totalPassed: number;
    totalTests: number;
    elapsedMs: number;
    memoryMb: number | null;
  } | null>(null);
  const [codingResults, setCodingResults] = useState<Array<{
    index: number;
    passed: boolean;
    error: string | null;
  }> | null>(null);
  const [showCodingSummary, setShowCodingSummary] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // ── Real-life interview state ──────────────────────────────────
  const [sessionTimeLeft, setSessionTimeLeft] = useState(INTERVIEW_DURATION_SECONDS);
  const [answerTimeLeft, setAnswerTimeLeft] = useState(ANSWER_TIME_LIMIT_SECONDS);
  const [isAnswerTimerActive, setIsAnswerTimerActive] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<InterviewPhase>("INTRO");
  const [micMode, setMicMode] = useState(true); // voice-first by default
  const [isMicListening, setIsMicListening] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [topicsCovered, setTopicsCovered] = useState<string[]>([]);
  const [interviewStarted, setInterviewStarted] = useState(false);

  const sessionTimerRef = useRef<number | null>(null);
  const answerTimerRef = useRef<number | null>(null);
  const micRecognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const micTranscriptRef = useRef<string>("");
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const speechRecognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const recordingStartQuestionIndexRef = useRef<number>(0);
  const codingTimerRef = useRef<number | null>(null);
  const hasAutoSubmittedRef = useRef(false);

  const formatCodingTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // ── Derived values ────────────────────────────────────────────
  const candidateResponsesCount = messages.filter((msg) => msg.role === "user").length;
  const isVideoPhase = candidateResponsesCount >= CHAT_QUESTION_COUNT;
  const answerTimerProgress = isAnswerTimerActive ? answerTimeLeft / ANSWER_TIME_LIMIT_SECONDS : 1;
  const sessionTimerProgress = sessionTimeLeft / INTERVIEW_DURATION_SECONDS;

  // Update phase whenever candidateResponsesCount changes
  useEffect(() => {
    const phase = getCurrentPhase(candidateResponsesCount);
    setCurrentPhase(phase);
  }, [candidateResponsesCount]);

  // ── Session Timer (25 min) ────────────────────────────────────
  useEffect(() => {
    if (!interviewStarted || interviewStatus === "COMPLETED") return;
    sessionTimerRef.current = window.setInterval(() => {
      setSessionTimeLeft((prev) => {
        if (prev <= 1) {
          if (sessionTimerRef.current) {
            window.clearInterval(sessionTimerRef.current);
            sessionTimerRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (sessionTimerRef.current) {
        window.clearInterval(sessionTimerRef.current);
        sessionTimerRef.current = null;
      }
    };
  }, [interviewStarted, interviewStatus]);

  // ── Answer Timer (90s) ────────────────────────────────────────
  useEffect(() => {
    if (!isAnswerTimerActive) return;
    answerTimerRef.current = window.setInterval(() => {
      setAnswerTimeLeft((prev) => {
        if (prev <= 1) {
          if (answerTimerRef.current) {
            window.clearInterval(answerTimerRef.current);
            answerTimerRef.current = null;
          }
          setIsAnswerTimerActive(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (answerTimerRef.current) {
        window.clearInterval(answerTimerRef.current);
        answerTimerRef.current = null;
      }
    };
  }, [isAnswerTimerActive]);

  // Auto-submit when answer timer runs out
  useEffect(() => {
    if (answerTimeLeft === 0 && !loading && interviewStarted && interviewStatus !== "COMPLETED") {
      handleSendMessage("[No response — candidate ran out of time]", false, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answerTimeLeft]);

  // Auto-wrap interview when session timer runs out
  useEffect(() => {
    if (sessionTimeLeft === 0 && interviewStarted && interviewStatus !== "COMPLETED") {
      handleSendMessage("The interview time is up. Please wrap up.", false, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionTimeLeft]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (sessionTimerRef.current) window.clearInterval(sessionTimerRef.current);
      if (answerTimerRef.current) window.clearInterval(answerTimerRef.current);
      if (micRecognitionRef.current) {
        micRecognitionRef.current.stop();
        micRecognitionRef.current = null;
      }
    };
  }, []);

  /** Start the answer countdown */
  const startAnswerTimer = useCallback(() => {
    setAnswerTimeLeft(ANSWER_TIME_LIMIT_SECONDS);
    setIsAnswerTimerActive(true);
  }, []);

  /** Stop the answer countdown */
  const stopAnswerTimer = useCallback(() => {
    setIsAnswerTimerActive(false);
    if (answerTimerRef.current) {
      window.clearInterval(answerTimerRef.current);
      answerTimerRef.current = null;
    }
  }, []);

  /** Voice-first mic input: start listening */
  const startMicListening = useCallback(() => {
    const browserWindow = window as typeof window & {
      SpeechRecognition?: new () => BrowserSpeechRecognition;
      webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
    };
    const SpeechRecognitionImpl = browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition;
    if (!SpeechRecognitionImpl) {
      alert("Speech recognition not supported. Please type your answer instead.");
      setMicMode(false);
      return;
    }
    const recognition = new SpeechRecognitionImpl();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i += 1) {
        transcript += event.results[i][0]?.transcript ?? "";
      }
      const trimmed = transcript.trim();
      micTranscriptRef.current = trimmed;
      setInput(trimmed);
    };
    recognition.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      console.error("Mic error:", event.error);
    };
    micTranscriptRef.current = "";
    recognition.start();
    micRecognitionRef.current = recognition;
    setIsMicListening(true);
  }, []);

  /** Voice-first mic input: stop listening and auto-submit */
  const stopMicListening = useCallback(() => {
    if (micRecognitionRef.current) {
      micRecognitionRef.current.stop();
      micRecognitionRef.current = null;
    }
    setIsMicListening(false);
  }, []);

  // Auto-scroll handled inside memoized ChatMessageList

  // ── Coding round derived values ───────────────────────────────
  // activeQuestions is now a state variable loaded on init
  const currentCodingQuestion = activeQuestions[currentCodingQuestionIndex] || activeQuestions[0];
  const monacoLanguage =
    CODING_LANGUAGES.find((lang) => lang.id === selectedCodingLanguage)?.monaco ?? "python";

  const cleanupMedia = useCallback(() => {
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.stop();
      speechRecognitionRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setPendingBlob(null);

    setCameraOn(false);
    setIsRecording(false);
    setRecordingTime(0);
  }, []);

  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  // Preload voices — browsers load them asynchronously
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const loadVoices = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };
    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
    };
  }, []);

  const speakText = useCallback((text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    // Slightly slower rate and warmer pitch for a smoother, more human feel
    utterance.rate = 0.92;
    utterance.pitch = 1.05;

    const voices = voicesRef.current;
    const enVoices = voices.filter((v) => v.lang.startsWith("en"));

    // Ranked preference: neural/online voices first (sound most human),
    // then well-known high-quality voices, then any English voice.
    const preferenceKeywords = [
      "aria online",     // Edge neural (very smooth)
      "jenny online",    // Edge neural
      "nova online",     // Edge neural
      "google uk english female",  // Chrome high-quality
      "google us english",         // Chrome
      "samantha",        // macOS (smooth)
      "karen",           // macOS AU
      "zira",            // Windows built-in
      "hazel",           // Windows UK
    ];

    let picked: SpeechSynthesisVoice | null = null;
    for (const keyword of preferenceKeywords) {
      const match = enVoices.find((v) => v.name.toLowerCase().includes(keyword));
      if (match) { picked = match; break; }
    }
    // Fallback: any "Online" neural voice, then any English female, then any English
    if (!picked) {
      picked = enVoices.find((v) => v.name.toLowerCase().includes("online"))
        ?? enVoices.find((v) => v.name.toLowerCase().includes("female"))
        ?? enVoices[0]
        ?? voices[0]
        ?? null;
    }
    if (picked) utterance.voice = picked;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, []);

  useEffect(() => {
    return () => {
      cleanupMedia();
      if (codingTimerRef.current) {
        window.clearInterval(codingTimerRef.current);
        codingTimerRef.current = null;
      }
      // Cancel speech on unmount
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [cleanupMedia]);

  useEffect(() => {
    if (!codingRoundStarted || codingRoundCompleted) return;

    codingTimerRef.current = window.setInterval(() => {
      setCodingTimeLeft((prev) => {
        if (prev <= 1) {
          if (codingTimerRef.current) {
            window.clearInterval(codingTimerRef.current);
            codingTimerRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (codingTimerRef.current) {
        window.clearInterval(codingTimerRef.current);
        codingTimerRef.current = null;
      }
    };
  }, [codingRoundStarted, codingRoundCompleted]);

  const evaluateCoding = useCallback(
    async (isSubmit: boolean) => {
      setCodingError("");
      if (isSubmit) setCodingSubmitLoading(true);
      else setCodingRunLoading(true);

      if (!currentCodingQuestion) {
        setCodingError("Question not loaded yet.");
        setCodingSubmitLoading(false);
        setCodingRunLoading(false);
        return;
      }

      try {
        const res = await fetch("/api/coding/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: codingCode,
            language: selectedCodingLanguage,
            questionId: currentCodingQuestion.id,
          }),
        });
        const payload = await res.json();
        if (!res.ok) {
          throw new Error(payload.error || "Failed to evaluate code.");
        }
        setCodingResults(payload.testResults || []);
        // accumulate summary (basic; memory available only if executor supports it)
        setCodingRoundSummary((prev) => {
          const passed = Number(payload.passedCount ?? 0);
          const total = Number(payload.totalCount ?? 0);
          const elapsed = Number(payload.elapsedMs ?? 0);
          const memoryMb = payload.memoryMb != null ? Number(payload.memoryMb) : null;
          if (!prev) {
            return { totalPassed: passed, totalTests: total, elapsedMs: elapsed, memoryMb };
          }
          return {
            totalPassed: prev.totalPassed + passed,
            totalTests: prev.totalTests + total,
            elapsedMs: prev.elapsedMs + elapsed,
            memoryMb: prev.memoryMb ?? memoryMb,
          };
        });
        if (isSubmit) {
          const passedCount = Number(payload.passedCount ?? 0);
          const totalCount = Number(payload.totalCount ?? 0);
          
          setCodingSubmissions((prev) => [
            ...prev,
            {
              questionId: currentCodingQuestion.id,
              title: currentCodingQuestion.title,
              language: selectedCodingLanguage,
              code: codingCode,
              passed: passedCount,
              total: totalCount,
            }
          ]);

          const updated = [...questionCompletion];
          updated[currentCodingQuestionIndex] = true;
          setQuestionCompletion(updated);
          if (currentCodingQuestionIndex < activeQuestions.length - 1) {
            const nextIndex = currentCodingQuestionIndex + 1;
            setCurrentCodingQuestionIndex(nextIndex);
            const nextQ = activeQuestions[nextIndex];
            setCodingCode(nextQ.starterByLanguage[selectedCodingLanguage]);
            setRunInput(selectedCodingLanguage === "sql" ? "" : (nextQ.tests[0]?.input ?? ""));
            setRunOutput("");
            setCodingResults(null);
          } else {
            setCodingRoundCompleted(true);
            if (codingTimerRef.current) {
              window.clearInterval(codingTimerRef.current);
              codingTimerRef.current = null;
            }
          }
        }
      } catch (error) {
        setCodingError(error instanceof Error ? error.message : "Evaluation failed.");
      } finally {
        setCodingRunLoading(false);
        setCodingSubmitLoading(false);
      }
    },
    [codingCode, currentCodingQuestion?.id, currentCodingQuestionIndex, questionCompletion, selectedCodingLanguage, activeQuestions]
  );

  const autoSubmitForCheating = useCallback(
    async (reason: string) => {
      if (!codingRoundStarted || codingRoundCompleted || hasAutoSubmittedRef.current) return;
      hasAutoSubmittedRef.current = true;
      setIsAutoSubmitting(true);
      setAutoSubmitReason(reason);
      setCodingError("");
      setAntiCheatLogs((prev) => [`Auto-submitted: ${reason}`, ...prev].slice(0, 8));

      if (!currentCodingQuestion) return;
      try {
        const res = await fetch("/api/coding/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: codingCode,
            language: selectedCodingLanguage,
            questionId: currentCodingQuestion.id,
          }),
          keepalive: true,
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(payload.error || "Auto-submit failed.");
        }
        setCodingResults(payload.testResults || []);
        
        const passedCount = Number(payload.passedCount ?? 0);
        const totalCount = Number(payload.totalCount ?? 0);
        
        setCodingSubmissions((prev) => [
          ...prev,
          {
            questionId: currentCodingQuestion.id,
            title: currentCodingQuestion.title,
            language: selectedCodingLanguage,
            code: codingCode,
            passed: passedCount,
            total: totalCount,
          }
        ]);
      } catch (error) {
        setCodingError(error instanceof Error ? error.message : "Auto-submit failed.");
      } finally {
        if (codingTimerRef.current) {
          window.clearInterval(codingTimerRef.current);
          codingTimerRef.current = null;
        }
        setCodingRoundCompleted(true);
        setIsAutoSubmitting(false);
      }
    },
    [codingCode, codingRoundCompleted, codingRoundStarted, currentCodingQuestion?.id, selectedCodingLanguage]
  );

  const registerCheatSignal = useCallback(
    (reason: string) => {
      if (!codingRoundStarted || codingRoundCompleted) return;
      setCheatWarnings((prev) => {
        const next = prev + 1;
        setAntiCheatLogs((logs) => [`Warning ${next}: ${reason}`, ...logs].slice(0, 8));
        if (next >= MAX_CHEAT_WARNINGS) {
          void autoSubmitForCheating(`Too many suspicious actions. Last reason: ${reason}`);
        }
        return next;
      });
    },
    [autoSubmitForCheating, codingRoundCompleted, codingRoundStarted]
  );

  useEffect(() => {
    if (!codingRoundStarted || codingRoundCompleted) return;

    const onVisibilityChange = () => {
      if (document.hidden) {
        void autoSubmitForCheating("Candidate switched tab/app or minimized the window.");
      }
    };

    const onWindowBlur = () => {
      registerCheatSignal("Window focus lost.");
    };

    const onFullscreenChange = () => {
      const active = Boolean(document.fullscreenElement);
      setIsFullscreenActive(active);
      if (!active) {
        registerCheatSignal("Fullscreen mode exited.");
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const blocked =
        (e.ctrlKey || e.metaKey) &&
        ["c", "v", "x", "a", "s", "u", "p"].includes(e.key.toLowerCase());
      if (blocked) {
        e.preventDefault();
        registerCheatSignal(`Blocked shortcut: ${e.key.toUpperCase()}`);
      }
    };

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (codingRoundStarted && !codingRoundCompleted) {
        fetch("/api/coding/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: codingCode,
            language: selectedCodingLanguage,
            questionId: currentCodingQuestion.id,
          }),
          keepalive: true,
        }).catch(() => {});
        e.preventDefault();
        e.returnValue = "";
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onWindowBlur);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onWindowBlur);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [
    autoSubmitForCheating,
    codingCode,
    codingRoundCompleted,
    codingRoundStarted,
    currentCodingQuestion?.id,
    registerCheatSignal,
    selectedCodingLanguage,
  ]);

  const runCode = useCallback(async () => {
    if (!currentCodingQuestion) return;
    setRunLoading(true);
    setCodingError("");
    setRunOutput("");
    try {
      const res = await fetch("/api/coding/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: codingCode,
          language: selectedCodingLanguage,
          questionId: currentCodingQuestion.id,
          stdin: runInput,
        }),
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || "Failed to run code.");
      }

      setRunOutput(payload.stderr ? `${payload.output}\n\n[stderr]\n${payload.stderr}` : payload.output);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Run failed.";
      setCodingError(message);
      setRunOutput(`Error: ${message}`);
    } finally {
      setRunLoading(false);
    }
  }, [codingCode, currentCodingQuestion?.id, runInput, selectedCodingLanguage]);

  const attachStreamToVideo = useCallback(() => {
    const videoEl = videoRef.current;
    const stream = mediaStreamRef.current;
    if (!videoEl || !stream) return;

    if (videoEl.srcObject !== stream) {
      videoEl.srcObject = stream;
    }

    videoEl.onloadedmetadata = () => {
      videoEl.play().catch(() => {
        // Browser autoplay permissions can block immediate playback.
      });
    };
  }, []);

  useEffect(() => {
    if (cameraOn) {
      attachStreamToVideo();
    }
  }, [cameraOn, attachStreamToVideo]);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: true,
      });
      mediaStreamRef.current = stream;
      setCameraOn(true);
      // Ensure stream gets attached even if video mounts after this function.
      setTimeout(() => attachStreamToVideo(), 0);
    } catch (error) {
      console.error(error);
      if (error instanceof DOMException && error.name === "NotAllowedError") {
      } else {
        alert("Could not access camera/microphone. Please check your device and try again.");
      }
    }
  }, [attachStreamToVideo]);

  const stopCamera = useCallback(() => {
    cleanupMedia();
  }, [cleanupMedia]);

  const startSpeechRecognition = useCallback(() => {
    const browserWindow = window as typeof window & {
      SpeechRecognition?: new () => BrowserSpeechRecognition;
      webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
    };
    const SpeechRecognitionImpl = browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition;

    if (!SpeechRecognitionImpl) {
      return false;
    }

    const recognition = new SpeechRecognitionImpl();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let latest = "";
      for (let i = 0; i < event.results.length; i += 1) {
        latest += event.results[i][0]?.transcript ?? "";
      }
      setTranscriptDraft(latest.trim());
    };
    recognition.onerror = (event) => {
      // "no-speech" is common when user is silent; avoid noisy console errors.
      if (event.error === "no-speech" || event.error === "aborted") {
        return;
      }
      console.error("Speech recognition error:", event.error);
    };
    recognition.start();
    speechRecognitionRef.current = recognition;
    return true;
  }, []);

  const startRecording = useCallback(() => {
    const stream = mediaStreamRef.current;
    if (!stream) {
      alert("Turn on camera first.");
      return;
    }

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      alert("No microphone detected. Please allow microphone access and try again.");
      return;
    }
    audioTracks.forEach((track) => { track.enabled = true; });

    // Capture questionIndex at START time (Bug fix: was captured at stop time before)
    recordingStartQuestionIndexRef.current = messages.filter((msg) => msg.role === "user").length + 1;

    try {
      const preferredTypes = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm;codecs=h264,opus",
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
        "video/mp4",
      ];
      const supportedMimeType = preferredTypes.find((t) => MediaRecorder.isTypeSupported(t)) || "";
      const recorderOptions: MediaRecorderOptions = {
        ...(supportedMimeType ? { mimeType: supportedMimeType } : {}),
        audioBitsPerSecond: 128000,
        videoBitsPerSecond: 2500000,
      };

      const recorder = new MediaRecorder(stream, recorderOptions);
      mediaRecorderRef.current = recorder;
      recordedChunksRef.current = [];
      setTranscriptDraft("");
      setRecordingTime(0);
      setIsRecording(true);
      setVideoUploadError("");
      setIsVideoSavedForAnswer(false);
      setPendingBlob(null);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      // On stop: keep blob pending and let user explicitly save.
      recorder.onstop = () => {
        const chunks = recordedChunksRef.current;
        recordedChunksRef.current = [];
        if (!chunks.length) return;
        const blob = new Blob(chunks, { type: recorder.mimeType || "video/webm" });
        setPendingBlob(blob);
        // Merge transcript draft into input so user can edit it
        setTranscriptDraft((draft) => {
          if (draft.trim()) setInput(draft.trim());
          return "";
        });
      };

      const speechEnabled = startSpeechRecognition();
      if (!speechEnabled) {
        alert("Speech-to-text is not supported in this browser. You can still type manually.");
      }

      recorder.start(1000);
      // Timer with auto-stop at max
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingTime((prev) => {
          if (prev + 1 >= MAX_RECORDING_SECONDS) {
            // Auto-stop at max recording time.
            if (recordingTimerRef.current) {
              window.clearInterval(recordingTimerRef.current);
              recordingTimerRef.current = null;
            }
            if (speechRecognitionRef.current) {
              speechRecognitionRef.current.stop();
              speechRecognitionRef.current = null;
            }
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
              mediaRecorderRef.current.stop();
            }
            mediaRecorderRef.current = null;
            setIsRecording(false);
            return MAX_RECORDING_SECONDS;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (error) {
      console.error(error);
      alert("Failed to start recording.");
      setIsRecording(false);
    }
  }, [messages, startSpeechRecognition]);

  const stopRecording = useCallback(() => {
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.stop();
      speechRecognitionRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    setIsRecording(false);
  }, []);

  // Accept recording: upload the pending blob
  const acceptRecording = useCallback(async () => {
    if (!pendingBlob) return;
    const questionIndex = recordingStartQuestionIndexRef.current;
    setUploadingVideo(true);
    setVideoUploadError("");
    try {
      const formData = new FormData();
      formData.append("sessionId", sessionId);
      formData.append("questionIndex", String(questionIndex));
      formData.append("durationSeconds", String(recordingTime));
      formData.append("video", pendingBlob, `answer-${questionIndex}.webm`);
      const res = await fetch("/api/interview/video/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "Failed to upload video");
      }
      const payload = (await res.json()) as { videoUrl: string };
      setLastUploadedVideoUrl(payload.videoUrl);
      setIsVideoSavedForAnswer(true);
    } catch (error) {
      console.error(error);
      setVideoUploadError(error instanceof Error ? error.message : "Failed to upload recording.");
    } finally {
      setUploadingVideo(false);
      setPendingBlob(null);
    }
  }, [pendingBlob, sessionId, recordingTime]);

  // Discard recording: clear preview without uploading
  const discardRecording = useCallback(() => {
    setPendingBlob(null);
    setIsVideoSavedForAnswer(false);
    setInput("");
  }, []);

  const handleSendMessage = useCallback(async (customInput?: string, isInitial: boolean = false, hasVideo: boolean = false, isVoice: boolean = false) => {
    const textToSend = isInitial ? "START_INTERVIEW" : (customInput ?? "");
    
    if (!textToSend.trim()) return;

    // Stop answer timer when user submits
    stopAnswerTimer();

    // Stop mic if listening
    if (isMicListening) stopMicListening();

    if (!isInitial) {
      const msgId = crypto.randomUUID();
      setMessages((prev) => [...prev, { id: msgId, role: "user", text: textToSend, hasVideo, timestamp: Date.now(), isVoice }]);
      setInput("");
    }

    // ── AI Thinking Delay ─────────────────────────────────────
    setIsThinking(true);
    setLoading(true);
    const thinkDelay = THINKING_DELAY_MS.min + Math.random() * (THINKING_DELAY_MS.max - THINKING_DELAY_MS.min);
    await new Promise((resolve) => setTimeout(resolve, thinkDelay));
    setIsThinking(false);

    try {
      const modelMessageId = crypto.randomUUID();
      setMessages((prev) => {
        return [...prev, { id: modelMessageId, role: "model", text: "", timestamp: Date.now() }];
      });

      const res = await fetch("/api/interview/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          message: textToSend,
          isInitial,
          phase: currentPhase,
          timeRemaining: sessionTimeLeft,
        }),
      });
      if (!res.ok || !res.body) {
        throw new Error("Failed to start streaming interview response");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffered = "";
      let doneEventSeen = false;
      let fullModelText = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffered += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");

        const events = buffered.split("\n\n");
        buffered = events.pop() ?? "";

        for (const event of events) {
          const dataLine = event
            .split("\n")
            .find((line) => line.startsWith("data: "));
          if (!dataLine) continue;

          const payload = JSON.parse(dataLine.slice(6)) as
            | { type: "chunk"; text: string }
            | { type: "done"; status: "PENDING" | "IN_PROGRESS" | "COMPLETED"; finalSummary?: string | null }
            | { type: "error"; error: string };

          if (payload.type === "chunk") {
            fullModelText += payload.text;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === modelMessageId ? { ...msg, text: msg.text + payload.text } : msg
              )
            );
          }

          if (payload.type === "done") {
            doneEventSeen = true;
            if (payload.status === "COMPLETED") {
              setCultureRoundStarted(true);
              if (payload.finalSummary) setFinalSummary(payload.finalSummary);
            }
          }

          if (payload.type === "error") {
            throw new Error(payload.error);
          }
        }
      }

      if (buffered.trim()) {
        const dataLine = buffered
          .split("\n")
          .find((line) => line.startsWith("data: "));
        if (dataLine) {
          const payload = JSON.parse(dataLine.slice(6)) as
            | { type: "chunk"; text: string }
            | { type: "done"; status: "PENDING" | "IN_PROGRESS" | "COMPLETED"; finalSummary?: string | null }
            | { type: "error"; error: string };
          if (payload.type === "chunk") {
            fullModelText += payload.text;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === modelMessageId ? { ...msg, text: msg.text + payload.text } : msg
              )
            );
          }
          if (payload.type === "done") {
            doneEventSeen = true;
            if (payload.status === "COMPLETED") {
              setCultureRoundStarted(true);
              if (payload.finalSummary) setFinalSummary(payload.finalSummary);
            }
          }
          if (payload.type === "error") {
            throw new Error(payload.error);
          }
        }
      }

      if (!doneEventSeen) {
        throw new Error("Streaming response ended unexpectedly");
      }
      // Speak the full AI response aloud
      if (fullModelText.trim()) {
        speakText(fullModelText);
      }

      // Mark interview as started after first AI message
      if (isInitial) {
        setInterviewStarted(true);
      }

      // Start the per-answer timer after AI finishes (unless interview is done)
      if (interviewStatus !== "COMPLETED") {
        startAnswerTimer();
      }

      // Extract topic keyword from AI message for sidebar
      const topicMatch = fullModelText.match(/(?:about|regarding|experience with|approach to)\s+([^?.!,]+)/i);
      if (topicMatch?.[1]) {
        const topic = topicMatch[1].trim().slice(0, 40);
        setTopicsCovered((prev) => prev.includes(topic) ? prev : [...prev, topic].slice(-8));
      }
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Failed to fetch AI response");
    } finally {
      setLoading(false);
    }
  }, [sessionId, speakText, currentPhase, sessionTimeLeft, stopAnswerTimer, startAnswerTimer, isMicListening, stopMicListening, interviewStatus]);

  // Fetch initial session state immediately
  useEffect(() => {
    const initSession = async () => {
      try {
        const res = await fetch(`/api/interview/chat?sessionId=${sessionId}`);
        if (!res.ok) throw new Error("Failed to load session");
        
        const data = await res.json();
        setInterviewStatus(data.status);
        
        const role = data.role || "GENERAL";
        setRoleTemplate(role);
        const roleQuestions = CODING_QUESTIONS_BY_ROLE[role] || CODING_QUESTIONS_BY_ROLE["GENERAL"];
        
        const selectedQuestions = roleQuestions.slice(0, 3);
        setActiveQuestions(selectedQuestions);
        setActiveQuestionIds(selectedQuestions.map(q => q.id));
        setQuestionCompletion(selectedQuestions.map(() => false));
        
        const defaultLang = role === "DATABASE" ? "sql" : role === "FRONTEND" ? "javascript" : "python";
        setSelectedCodingLanguage(defaultLang);
        setCodingCode(selectedQuestions[0]?.starterByLanguage[defaultLang] || "");
        setRunInput(defaultLang === "sql" ? "" : selectedQuestions[0]?.tests[0]?.input || "");
        
        if (data.transcript && data.transcript.length > 0) {
          setMessages(
            data.transcript.map((msg: { role: "user" | "model"; text: string }) => ({
              id: crypto.randomUUID(),
              role: msg.role,
              text: msg.text,
            }))
          );
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    initSession();
  }, [sessionId]);

  // Start chat after coding round completes
  useEffect(() => {
    if (!codingRoundCompleted) return;
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    if (autoSubmitReason) {
      fetch("/api/interview/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, reason: autoSubmitReason }),
        keepalive: true,
      }).catch(() => {});
      return;
    }
    if (messages.length === 0) {
      handleSendMessage("", true);
    }
  }, [codingRoundCompleted, autoSubmitReason, handleSendMessage, messages.length, sessionId]);

  const completeInterview = () => {
    setCultureRoundStarted(true);
  };

  const submitCultureAndCompleteInterview = async (cultureData: any) => {
    setLoading(true);
    try {
      const codingScore = codingRoundSummary && codingRoundSummary.totalTests > 0 
        ? (codingRoundSummary.totalPassed / codingRoundSummary.totalTests) * 100 
        : 0;

      await fetch("/api/interview/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          sessionId,
          codingScore,
          codingSubmissions,
          cultureResponses: cultureData
        }),
      });
      cleanupMedia();
      setInterviewStatus("COMPLETED");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Show the auto-submit cancellation page immediately when tab-switch cheating is detected
  if (codingRoundCompleted && autoSubmitReason) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white p-6 relative overflow-hidden">
        {/* Animated background glow */}
        <div
          style={{
            position: "absolute",
            top: "20%",
            left: "50%",
            transform: "translateX(-50%)",
            width: "600px",
            height: "600px",
            background: "radial-gradient(circle, rgba(239,68,68,0.12) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-full max-w-lg relative z-10"
        >
          {/* Card */}
          <div
            style={{
              background: "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
              border: "1px solid rgba(255,255,255,0.08)",
              backdropFilter: "blur(24px)",
            }}
            className="rounded-3xl p-10 text-center"
          >
            {/* Pulsing shield icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 15 }}
              className="mx-auto mb-6 w-20 h-20 rounded-full flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, rgba(239,68,68,0.2) 0%, rgba(239,68,68,0.05) 100%)",
                border: "1px solid rgba(239,68,68,0.3)",
                boxShadow: "0 0 40px rgba(239,68,68,0.15)",
              }}
            >
              <ShieldOff size={36} className="text-red-400" />
            </motion.div>

            {/* Title */}
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.5 }}
              className="text-2xl font-bold mb-2"
              style={{
                background: "linear-gradient(135deg, #fff 30%, #f87171 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Round Auto-Submitted
            </motion.h2>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.45, duration: 0.5 }}
              className="text-slate-400 text-sm mb-6 max-w-sm mx-auto leading-relaxed"
            >
              Your coding round was automatically submitted because you switched
              away from the test window. The interview session has been cancelled.
            </motion.p>

            {/* Reason card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55, duration: 0.5 }}
              className="rounded-2xl p-5 mb-6 text-left"
              style={{
                background: "rgba(239,68,68,0.06)",
                border: "1px solid rgba(239,68,68,0.18)",
              }}
            >
              <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">
                Violation Detected
              </p>
              <p className="text-sm text-red-200 leading-relaxed">
                {autoSubmitReason}
              </p>
            </motion.div>

            {/* Cancelled badge */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.65, duration: 0.5 }}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 mb-8 text-xs font-medium"
              style={{
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.2)",
                color: "#fca5a5",
              }}
            >
              <span
                className="w-2 h-2 rounded-full bg-red-400"
                style={{ boxShadow: "0 0 6px rgba(239,68,68,0.6)" }}
              />
              Interview Session Cancelled
            </motion.div>

            {/* Home button */}
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.75, duration: 0.5 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => router.push("/")}
              className="w-full py-4 rounded-2xl font-semibold text-white flex items-center justify-center gap-2 transition-shadow"
              style={{
                background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                boxShadow: "0 4px 24px rgba(99,102,241,0.3)",
              }}
            >
              <Home size={18} />
              Return to Home
            </motion.button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (codingRoundCompleted && loading && messages.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400">Connecting to AI Interviewer...</p>
        </div>
      </div>
    );
  }

  if (codingRoundCompleted && !autoSubmitReason && codingRoundSummary && showCodingSummary) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white p-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-full max-w-2xl bg-white/5 border border-white/10 rounded-3xl p-8"
        >
          <h2 className="text-2xl font-bold mb-2">Coding Round Evaluation</h2>
          <p className="text-slate-400 text-sm mb-6">
            Summary based on your submissions. Runtime/memory depend on the execution environment.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-4">
              <p className="text-xs text-slate-400 mb-1">Tests Passed</p>
              <p className="text-2xl font-bold">
                {codingRoundSummary.totalPassed}/{codingRoundSummary.totalTests}
              </p>
            </div>
            <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-4">
              <p className="text-xs text-slate-400 mb-1">Total Runtime</p>
              <p className="text-2xl font-bold">{Math.max(0, Math.round(codingRoundSummary.elapsedMs))} ms</p>
            </div>
            <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-4">
              <p className="text-xs text-slate-400 mb-1">Memory</p>
              <p className="text-2xl font-bold">
                {codingRoundSummary.memoryMb == null ? "N/A" : `${codingRoundSummary.memoryMb.toFixed(1)} MB`}
              </p>
            </div>
          </div>

          <div className="text-sm text-slate-300 mb-6">
            You have completed the coding round. Click below to proceed to the AI interview.
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowCodingSummary(false)}
            className="w-full py-4 rounded-2xl font-semibold text-white flex items-center justify-center gap-2 transition-shadow"
            style={{
              background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
              boxShadow: "0 4px 24px rgba(99,102,241,0.3)",
            }}
          >
            Proceed to Interview Round →
          </motion.button>
        </motion.div>
      </div>
    );
  }

  if (!codingRoundCompleted) {
    return (
      <div className="h-[100svh] w-full bg-slate-950 text-white overflow-hidden">
        {!codingRoundStarted && !showCodingCaution ? (
          <div className="h-full w-full flex items-center justify-center p-6">
            <div className="w-full max-w-3xl bg-white/5 border border-white/10 rounded-3xl p-8">
              <h1 className="text-2xl md:text-3xl font-bold">Coding Round - {roleTemplate} Engineer</h1>
              <p className="text-slate-400 text-sm mt-1">Select language, solve 3 coding questions in 30 minutes.</p>
              <div className="mt-6 bg-slate-900/50 border border-white/10 rounded-2xl p-6">
                <h2 className="text-xl font-semibold mb-2">Choose Coding Language</h2>
                <div className="grid grid-cols-2 gap-3">
                  {CODING_LANGUAGES.map((lang) => {
                    const isDataRole = roleTemplate === "DATA" || roleTemplate === "AI_ML";
                    const isDbRole = roleTemplate === "DATABASE";
                    const isDisabled = 
                      (isDataRole && lang.id !== "python") || 
                      (isDbRole && lang.id !== "sql") || 
                      (!isDbRole && lang.id === "sql");
                    return (
                      <button
                        key={lang.id}
                        disabled={isDisabled}
                        onClick={() => {
                          setSelectedCodingLanguage(lang.id);
                          if (activeQuestions.length > 0) {
                            setCodingCode(activeQuestions[0].starterByLanguage[lang.id]);
                          }
                        }}
                        className={`rounded-lg border px-3 py-2 text-sm text-left ${
                          selectedCodingLanguage === lang.id
                            ? "bg-indigo-500/20 border-indigo-400 text-white"
                            : isDisabled
                            ? "bg-slate-900/20 border-slate-800 text-slate-600 cursor-not-allowed"
                            : "bg-slate-950/50 border-slate-700 text-slate-300"
                        }`}
                      >
                        {lang.label} {isDisabled && "(Not Allowed)"}
                      </button>
                    );
                  })}
                </div>
                <p className="text-slate-400 text-xs mt-4">
                  Questions: (Random Medium set of 3 will be selected on start)
                </p>
                <button
                  onClick={() => {
                    if (activeQuestions.length === 0) return;
                    // Note: activeQuestions is already sized to 3 questions from initInterview
                    setActiveQuestionIds(activeQuestions.map((q) => q.id));
                    setCurrentCodingQuestionIndex(0);
                    setQuestionCompletion(activeQuestions.map(() => false));
                    const q0 = activeQuestions[0];
                    setCodingCode(q0.starterByLanguage[selectedCodingLanguage]);
                    setRunInput(selectedCodingLanguage === "sql" ? "" : (q0.tests[0]?.input ?? ""));
                    setShowCodingCaution(true);
                  }}
                  className="mt-6 px-5 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 transition-colors font-medium"
                >
                  Continue to Instructions
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full w-full p-3 md:p-4">
            {showCodingCaution && !codingRoundStarted && (
              <div className="h-full w-full flex items-center justify-center">
                <div className="w-full max-w-3xl bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8">
                  <h2 className="text-2xl font-bold mb-2">Coding Round - Important Instructions</h2>
                  <p className="text-sm text-slate-300 mb-5">
                    Please read carefully before starting. Once you continue, the timer starts immediately.
                  </p>

                  <div className="space-y-3 text-sm text-slate-300">
                    <p>- Duration is <span className="font-semibold text-white">30 minutes</span>.</p>
                    <p>- You must solve <span className="font-semibold text-white">3 coding questions</span>.</p>
                    <p>- Selected language: <span className="font-semibold text-white">{CODING_LANGUAGES.find((l) => l.id === selectedCodingLanguage)?.label}</span>.</p>
                    <p>- Use <span className="font-semibold text-white">Run Code</span> for custom output checks, then <span className="font-semibold text-white">Run Test Cases</span>.</p>
                    <p>- Suspicious behavior can trigger warning and auto-submit.</p>
                    <p>- Switching tab/app or minimizing can auto-submit your code.</p>
                    <p>- Exiting fullscreen or repeated blocked shortcuts may trigger auto-submit.</p>
                    <p>- When time ends, submit immediately with your latest code.</p>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      onClick={() => setShowCodingCaution(false)}
                      className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm"
                    >
                      Back
                    </button>
                    <button
                      onClick={async () => {
                        if (document.documentElement.requestFullscreen) {
                          try {
                            await document.documentElement.requestFullscreen();
                            setIsFullscreenActive(true);
                          } catch {
                            setIsFullscreenActive(false);
                          }
                        }
                        setCheatWarnings(0);
                        setAntiCheatLogs([]);
                        hasAutoSubmittedRef.current = false;
                        setShowCodingCaution(false);
                        setCodingTimeLeft(CODING_ROUND_SECONDS);
                        setCodingRoundStarted(true);
                        setLoading(false);
                      }}
                      className="px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-sm font-medium"
                    >
                      I Understand, Start Round
                    </button>
                  </div>
                </div>
              </div>
            )}
            {!showCodingCaution && codingRoundStarted && (
            <div className="h-full w-full bg-white/5 border border-white/10 rounded-2xl flex flex-col overflow-hidden">
              <div className="shrink-0 px-4 py-3 border-b border-white/10 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold truncate">
                    Q{currentCodingQuestionIndex + 1}: {currentCodingQuestion.title}
                  </h2>
                  <p className="text-xs text-slate-400 truncate">
                    {currentCodingQuestion.difficulty} - {currentCodingQuestion.source} - {CODING_LANGUAGES.find((l) => l.id === selectedCodingLanguage)?.label}
                  </p>
                </div>
                <div className="px-3 py-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-sm font-medium inline-flex items-center gap-2 shrink-0">
                  <Clock size={16} />
                  Time Left: {formatCodingTime(codingTimeLeft)}
                </div>
              </div>

              <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-5 gap-3 p-3">
                {/* Left: Problem statement */}
                <div className="min-h-0 xl:col-span-2 bg-slate-900/50 border border-white/10 rounded-xl p-3 overflow-auto">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-medium text-slate-200">Problem</p>
                    <span className="text-[11px] text-slate-400">{currentCodingQuestion.difficulty}</span>
                  </div>
                  <p className="text-sm text-white font-semibold mt-1">{currentCodingQuestion.title}</p>
                  <p className="text-[11px] text-slate-400 mt-1">{currentCodingQuestion.source}</p>

                  <div className="mt-3">
                    <p className="text-xs text-slate-300 font-medium mb-1">Description</p>
                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {currentCodingQuestion.description}
                    </p>
                  </div>

                  <div className="mt-3">
                    <p className="text-xs text-slate-300 font-medium mb-1">Input Format</p>
                    <pre className="text-[11px] bg-black/30 border border-slate-700 rounded-lg p-2 text-slate-200 whitespace-pre-wrap">
                      {currentCodingQuestion.inputFormat}
                    </pre>
                  </div>

                  <div className="mt-3">
                    <p className="text-xs text-slate-300 font-medium mb-1">Output Format</p>
                    <pre className="text-[11px] bg-black/30 border border-slate-700 rounded-lg p-2 text-slate-200 whitespace-pre-wrap">
                      {currentCodingQuestion.outputFormat}
                    </pre>
                  </div>

                  <div className="mt-3">
                    <p className="text-xs text-slate-300 font-medium mb-1">Constraints</p>
                    <ul className="space-y-1">
                      {currentCodingQuestion.constraints.map((c) => (
                        <li key={c} className="text-[11px] text-slate-300">
                          - {c}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-3">
                    <p className="text-xs text-slate-300 font-medium mb-2">Examples</p>
                    <div className="space-y-3">
                      {currentCodingQuestion.examples.map((ex, idx) => (
                        <div key={idx} className="bg-black/30 border border-slate-700 rounded-lg p-2">
                          <p className="text-[11px] text-slate-400 mb-2">Example {idx + 1}</p>
                          <p className="text-[11px] text-slate-300 mb-1">Input</p>
                          <pre className="text-[11px] text-slate-100 whitespace-pre-wrap">{ex.input}</pre>
                          <p className="text-[11px] text-slate-300 mt-2 mb-1">Output</p>
                          <pre className="text-[11px] text-slate-100 whitespace-pre-wrap">{ex.output}</pre>
                          <p className="text-[11px] text-slate-300 mt-2 mb-1">Explanation</p>
                          <p className="text-[11px] text-slate-300 whitespace-pre-wrap">{ex.explanation}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Middle: Editor */}
                <div className="min-h-0 xl:col-span-2 bg-slate-950 border border-slate-700 rounded-xl p-3 flex flex-col">
                  <p className="text-xs text-slate-400 mb-2">
                    Compiler ({CODING_LANGUAGES.find((l) => l.id === selectedCodingLanguage)?.label})
                  </p>
                  <div className="flex-1 min-h-0 overflow-hidden rounded-lg border border-slate-700">
                    <MonacoEditor
                      height="100%"
                      language={monacoLanguage}
                      value={codingCode}
                      onChange={(value) => setCodingCode(value ?? "")}
                      theme="vs-dark"
                      options={{
                        readOnly: codingTimeLeft === 0 || codingSubmitLoading,
                        minimap: { enabled: false },
                        fontSize: 14,
                        lineNumbers: "on",
                        wordWrap: "on",
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        tabSize: 2,
                        contextmenu: false,
                        copyWithSyntaxHighlighting: false,
                        bracketPairColorization: { enabled: true },
                      }}
                    />
                  </div>
                </div>

                {/* Right: run/output/actions */}
                <div className="min-h-0 xl:col-span-1 bg-slate-900/50 border border-white/10 rounded-xl p-3 flex flex-col gap-3 overflow-hidden">
                  <div className="shrink-0">
                    <p className="text-xs text-slate-400 mb-1">Run Input (stdin)</p>
                    <textarea
                      value={runInput}
                      onChange={(e) => setRunInput(e.target.value)}
                      disabled={codingSubmitLoading}
                      onPaste={(e) => {
                        e.preventDefault();
                        registerCheatSignal("Paste blocked in custom input.");
                      }}
                      className="w-full h-28 bg-black/40 border border-slate-700 rounded-lg p-2 font-mono text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                    />
                    <p className="text-[11px] text-slate-500 mt-2">
                      Example input from tests: {currentCodingQuestion.tests[0]?.input.replace(/\n/g, " | ")}
                    </p>
                  </div>

                  <div className="shrink-0 flex flex-col gap-2">
                    <button
                      onClick={runCode}
                      disabled={runLoading || codingSubmitLoading || codingTimeLeft === 0 || isAutoSubmitting}
                      className="w-full px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-800 text-white text-xs"
                    >
                      {runLoading ? "Running Code..." : "Run Code"}
                    </button>
                    <button
                      onClick={() => evaluateCoding(false)}
                      disabled={codingRunLoading || runLoading || codingSubmitLoading || codingTimeLeft === 0 || isAutoSubmitting}
                      className="w-full px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 text-white text-xs"
                    >
                      {codingRunLoading ? "Running..." : "Run Test Cases"}
                    </button>
                    <button
                      onClick={() => evaluateCoding(true)}
                      disabled={codingRunLoading || runLoading || codingSubmitLoading || isAutoSubmitting}
                      className="w-full px-3 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-800 text-white text-xs"
                    >
                      {codingSubmitLoading
                        ? "Submitting..."
                        : currentCodingQuestionIndex < activeQuestions.length - 1
                          ? "Submit & Next Question"
                          : "Submit Coding Round"}
                    </button>
                  </div>

                  <div className="min-h-0 flex-1 overflow-auto space-y-3">
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Output</p>
                      <pre className="w-full h-24 bg-black/40 border border-slate-700 rounded-lg p-2 font-mono text-xs text-slate-100 whitespace-pre-wrap overflow-auto">
                        {runOutput || "Run your code to see output..."}
                      </pre>
                    </div>

                    <div className="bg-slate-950/60 border border-white/10 rounded-lg p-2">
                      <p className="text-xs text-slate-400 mb-1">Anti-Cheat</p>
                      <p className="text-[11px] text-slate-300">Fullscreen: {isFullscreenActive ? "Active" : "Inactive"}</p>
                      <p className={`text-[11px] ${cheatWarnings > 0 ? "text-amber-300" : "text-green-300"}`}>
                        Warnings: {cheatWarnings}/{MAX_CHEAT_WARNINGS}
                      </p>
                      {isAutoSubmitting && <p className="text-[11px] text-red-300">Auto-submitting...</p>}
                      {antiCheatLogs.length > 0 && (
                        <div className="mt-1 space-y-1">
                          {antiCheatLogs.slice(0, 3).map((log, idx) => (
                            <p key={`${log}-${idx}`} className="text-[11px] text-slate-400">{log}</p>
                          ))}
                        </div>
                      )}
                    </div>

                    {codingError && (
                      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 text-xs text-red-300">
                        {codingError}
                      </div>
                    )}

                    {codingResults && (
                      <div className="bg-slate-950/60 border border-white/10 rounded-lg p-2">
                        <p className="text-xs text-slate-300 mb-1">Test Results</p>
                        <div className="space-y-1">
                          {codingResults.map((result) => (
                            <p
                              key={result.index}
                              className={`text-[11px] px-2 py-1 rounded border ${
                                result.passed
                                  ? "bg-green-500/10 border-green-500/30 text-green-300"
                                  : "bg-red-500/10 border-red-500/30 text-red-300"
                              }`}
                            >
                              Test {result.index}: {result.passed ? "Passed" : `Failed${result.error ? ` - ${result.error}` : ""}`}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    {codingTimeLeft === 0 && (
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2 text-xs text-amber-200">
                        Time is up. Submit your latest code to continue.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (cultureRoundStarted && interviewStatus !== "COMPLETED") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white p-6 relative overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-600/10 blur-[120px] pointer-events-none" />

        <div className="w-full max-w-2xl bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl p-8 md:p-10 z-10">
          <div className="mb-8 text-center">
            <h2 className="text-3xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">
              Round 3: Culture & Alignment
            </h2>
            <p className="text-slate-400 text-sm">
              Please answer a few quick questions about your work style and preferences to help us find the best fit.
            </p>
          </div>

          <div className="space-y-8">
            {/* Likert Scale Questions */}
            <div className="space-y-6">
              {[
                { key: "fastPaced", label: "I prefer working in a fast-paced environment." },
                { key: "collaboration", label: "I thrive when collaborating closely with a team." },
                { key: "adaptability", label: "I am comfortable with rapidly shifting priorities." }
              ].map((q) => (
                <div key={q.key} className="bg-slate-900/50 p-5 rounded-2xl border border-white/5">
                  <label className="block text-sm font-medium mb-4 text-slate-200">
                    {q.label}
                  </label>
                  <div className="flex justify-between items-center px-2">
                    <span className="text-xs text-slate-500 font-medium">Strongly Disagree</span>
                    <div className="flex gap-4">
                      {[1, 2, 3, 4, 5].map((val) => (
                        <button
                          key={val}
                          onClick={() => setCultureResponses(prev => ({ ...prev, [q.key]: val }))}
                          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                            cultureResponses[q.key as keyof typeof cultureResponses] === val
                              ? "bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)] scale-110"
                              : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                          }`}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                    <span className="text-xs text-slate-500 font-medium">Strongly Agree</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Preference Question */}
            <div className="bg-slate-900/50 p-5 rounded-2xl border border-white/5">
              <label className="block text-sm font-medium mb-3 text-slate-200">
                Preferred Work Arrangement
              </label>
              <select
                value={cultureResponses.location}
                onChange={(e) => setCultureResponses(prev => ({ ...prev, location: e.target.value }))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Remote">Fully Remote</option>
                <option value="Hybrid">Hybrid</option>
                <option value="Onsite">Fully Onsite</option>
              </select>
            </div>
          </div>

          <div className="mt-10 pt-8 border-t border-white/10 flex justify-end">
            <button
              onClick={() => submitCultureAndCompleteInterview(cultureResponses)}
              disabled={loading}
              className="px-8 py-3 bg-indigo-500 hover:bg-indigo-600 rounded-xl font-medium transition-all text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit & Complete Interview"
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (interviewStatus === "COMPLETED") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white p-6">
        <div className="text-center max-w-md bg-white/5 border border-white/10 p-8 rounded-3xl backdrop-blur-xl">
          <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h2 className="text-3xl font-bold mb-4">Interview Completed</h2>
          <p className="text-slate-400 mb-8">
            Thank you for your time. The AI has evaluated your responses and the results have been sent to the recruiter.
          </p>
          <button 
            onClick={() => router.push(`/interview/${sessionId}/feedback`)}
            className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 rounded-xl font-medium transition-colors"
          >
            View AI Feedback
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100svh] w-full bg-slate-950 text-white flex overflow-hidden">

      {/* ── Phase Sidebar ─────────────────────────────────────── */}
      {sidebarOpen && (
        <motion.div
          initial={{ x: -260 }} animate={{ x: 0 }} exit={{ x: -260 }}
          className="shrink-0 w-60 flex flex-col border-r border-white/6 bg-slate-900/60 backdrop-blur-md"
        >
          <div className="px-4 py-4 border-b border-white/6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Interview Progress</h3>
            <div className="space-y-2">
              {INTERVIEW_PHASES.map((phase) => {
                const isActive = currentPhase === phase.id;
                const isPast = INTERVIEW_PHASES.findIndex(p => p.id === currentPhase) > INTERVIEW_PHASES.findIndex(p => p.id === phase.id);
                return (
                  <div key={phase.id} className="flex items-center gap-2.5">
                    <div className={`w-3 h-3 rounded-full shrink-0 border-2 transition-all ${
                      isActive ? "bg-indigo-500 border-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.5)]"
                        : isPast ? "bg-green-500 border-green-400" : "bg-transparent border-slate-600"
                    }`} />
                    <div>
                      <p className={`text-[11px] font-medium ${isActive ? "text-white" : isPast ? "text-green-300" : "text-slate-500"}`}>{phase.label}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Session timer */}
          <div className="px-4 py-3 border-b border-white/6">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Session Time</p>
            <p className={`text-xl font-mono font-bold ${sessionTimeLeft <= 300 ? "text-amber-400 animate-pulse" : "text-white"}`}>
              {formatCodingTime(sessionTimeLeft)}
            </p>
            <div className="mt-1.5 h-1 rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${sessionTimerProgress * 100}%`,
                  background: sessionTimeLeft <= 300 ? "linear-gradient(90deg, #f59e0b, #ef4444)" : "linear-gradient(90deg, #6366f1, #8b5cf6)",
                }}
              />
            </div>
          </div>

          {/* Answer timer */}
          {isAnswerTimerActive && (
            <div className="px-4 py-3 border-b border-white/6">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Answer Time</p>
              <div className="flex items-center gap-2">
                <svg width="36" height="36" viewBox="0 0 36 36" className="shrink-0">
                  <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15" fill="none"
                    stroke={answerTimeLeft <= 15 ? "#ef4444" : "#6366f1"}
                    strokeWidth="3" strokeLinecap="round"
                    strokeDasharray={`${answerTimerProgress * 94.25} 94.25`}
                    transform="rotate(-90 18 18)"
                    style={{ transition: "stroke-dasharray 1s linear" }}
                  />
                  <text x="18" y="18" textAnchor="middle" dominantBaseline="central"
                    className={`text-[9px] font-bold ${answerTimeLeft <= 15 ? "fill-red-400" : "fill-white"}`}
                  >{answerTimeLeft}s</text>
                </svg>
                <p className={`text-xs ${answerTimeLeft <= 15 ? "text-red-400 animate-pulse" : "text-slate-400"}`}>
                  {answerTimeLeft <= 15 ? "Hurry up!" : "Your turn"}
                </p>
              </div>
            </div>
          )}

          {/* Topics covered */}
          {topicsCovered.length > 0 && (
            <div className="px-4 py-3 border-b border-white/6">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Topics Discussed</p>
              <div className="flex flex-wrap gap-1">
                {topicsCovered.map((topic) => (
                  <span key={topic} className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/20">{topic}</span>
                ))}
              </div>
            </div>
          )}

          {/* Q count */}
          <div className="px-4 py-3 mt-auto">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Responses</p>
            <p className="text-lg font-bold">{candidateResponsesCount}<span className="text-slate-500 text-sm">/{MAX_QUESTION_COUNT}</span></p>
          </div>
        </motion.div>
      )}

      {/* ── Main Content ──────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top Bar */}
        <div
          className="shrink-0 flex items-center justify-between px-4 py-2.5"
          style={{
            background: "linear-gradient(180deg, rgba(15,23,42,0.95) 0%, rgba(15,23,42,0.8) 100%)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 text-slate-400 transition-colors">
              {sidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
            </button>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 0 16px rgba(99,102,241,0.3)" }}
            >
              <Bot size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white leading-tight">Interview with Alex</h2>
              <p className="text-[11px] text-green-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> Live
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Compact session timer in top bar */}
            <div className={`flex items-center gap-1.5 text-xs font-mono ${sessionTimeLeft <= 300 ? "text-amber-400" : "text-slate-400"}`}>
              <Timer size={13} />
              {formatCodingTime(sessionTimeLeft)}
            </div>
            <button
              onClick={completeInterview}
              className="text-xs px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg transition-colors"
            >
              End
            </button>
          </div>
        </div>

      {/* Video Call Grid */}
      <div className="flex-1 flex flex-col lg:flex-row gap-3 p-3 min-h-0">

        {/* Left: AI Recruiter Panel */}
        <div className="flex-1 min-h-0 flex flex-col rounded-2xl overflow-hidden relative"
          style={{
            background: "linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(139,92,246,0.04) 100%)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {/* AI Avatar */}
          <div className="flex-1 flex items-center justify-center relative overflow-hidden">
            {/* Ambient glow behind avatar */}
            <div
              className="absolute"
              style={{
                width: "320px",
                height: "320px",
                background: "radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)",
                pointerEvents: "none",
              }}
            />
            <motion.div
              animate={(loading || isSpeaking) ? { scale: [1, 1.03, 1] } : { scale: 1 }}
              transition={(loading || isSpeaking) ? { repeat: Infinity, duration: 2, ease: "easeInOut" } : {}}
              className="relative z-10"
            >
              <div
                className="w-40 h-40 md:w-52 md:h-52 rounded-full overflow-hidden"
                style={{
                  border: (loading || isSpeaking) ? "3px solid rgba(99,102,241,0.6)" : "3px solid rgba(255,255,255,0.1)",
                  boxShadow: (loading || isSpeaking) ? "0 0 30px rgba(99,102,241,0.3)" : "0 0 20px rgba(0,0,0,0.3)",
                  transition: "border-color 0.3s, box-shadow 0.3s",
                }}
              >
                <img
                  src="/ai-recruiter.png"
                  alt="AI Recruiter"
                  className="w-full h-full object-cover"
                />
              </div>
            </motion.div>
          </div>

          {/* AI label bar */}
          <div className="shrink-0 px-4 py-2.5 flex items-center justify-between"
            style={{ background: "rgba(0,0,0,0.3)", borderTop: "1px solid rgba(255,255,255,0.05)" }}
          >
            <div className="flex items-center gap-2">
              <Bot size={14} className="text-indigo-400" />
              <span className="text-xs font-medium text-slate-200">Alex (Interviewer)</span>
            </div>
            {isThinking && (
              <span className="text-[10px] text-amber-300 italic animate-pulse">Reviewing your answer...</span>
            )}
            {!isThinking && (loading || isSpeaking) && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-indigo-300">Speaking</span>
                <div className="flex items-end gap-[2px]">
                  <div className="w-[3px] bg-indigo-400 rounded-full animate-pulse" style={{ height: "8px" }} />
                  <div className="w-[3px] bg-indigo-400 rounded-full animate-pulse" style={{ height: "14px", animationDelay: "0.15s" }} />
                  <div className="w-[3px] bg-indigo-400 rounded-full animate-pulse" style={{ height: "10px", animationDelay: "0.3s" }} />
                  <div className="w-[3px] bg-indigo-400 rounded-full animate-pulse" style={{ height: "6px", animationDelay: "0.45s" }} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Candidate Camera Panel */}
        <div className="flex-1 min-h-0 flex flex-col rounded-2xl overflow-hidden relative"
          style={{
            background: "rgba(0,0,0,0.4)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {/* Camera feed */}
          <div className="flex-1 flex items-center justify-center relative overflow-hidden bg-black/60">
            {cameraOn ? (
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
                style={{ transform: "scaleX(-1)" }}
              />
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                  <VideoOff size={24} className="text-slate-500" />
                </div>
                <p className="text-xs text-slate-500">Camera is off</p>
                <button
                  onClick={startCamera}
                  className="text-xs px-4 py-2 bg-indigo-500 hover:bg-indigo-600 rounded-lg transition-colors"
                >
                  Turn On Camera
                </button>
              </div>
            )}

            {/* Recording indicator overlay */}
            {isRecording && (
              <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[11px] text-red-300 font-medium">REC {recordingTime}s</span>
              </div>
            )}
          </div>

          {/* Candidate label bar */}
          <div className="shrink-0 px-4 py-2.5 flex items-center justify-between"
            style={{ background: "rgba(0,0,0,0.3)", borderTop: "1px solid rgba(255,255,255,0.05)" }}
          >
            <div className="flex items-center gap-2">
              <User size={14} className="text-blue-400" />
              <span className="text-xs font-medium text-slate-200">You (Candidate)</span>
            </div>
            {cameraOn && (
              <button
                onClick={stopCamera}
                className="text-[10px] px-2 py-1 bg-slate-700/60 hover:bg-slate-600/60 rounded text-slate-300 transition-colors"
              >
                Turn Off
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Chat Messages + Controls */}
      <div className="shrink-0 flex flex-col" style={{ maxHeight: "45%", borderTop: "1px solid rgba(255,255,255,0.06)" }}>

        {/* Messages scroll area */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0" style={{ maxHeight: "240px" }}>
          <ChatMessageList messages={messages} isThinking={isThinking} loading={loading} />
        </div>

        {/* Bottom Controls Bar */}
        <div
          className="shrink-0 px-4 py-3 flex items-center gap-2"
          style={{ background: "rgba(15,23,42,0.9)", borderTop: "1px solid rgba(255,255,255,0.05)" }}
        >
          {/* Video controls */}
          {isVideoPhase && cameraOn && (
            <div className="flex items-center gap-1.5 mr-1">
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  disabled={loading}
                  className="p-2 rounded-full bg-green-600 hover:bg-green-700 disabled:bg-slate-700 text-white transition-colors"
                  title="Start Recording"
                >
                  <Video size={16} />
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="p-2 rounded-full bg-red-600 hover:bg-red-700 text-white transition-colors animate-pulse"
                  title="Stop Recording"
                >
                  <Mic size={16} />
                </button>
              )}
              {pendingBlob && !isRecording && (
                <>
                  <button
                    onClick={acceptRecording}
                    disabled={uploadingVideo}
                    className="p-2 rounded-full bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-700 text-white transition-colors"
                    title="Save Video"
                  >
                    <CheckCircle size={16} />
                  </button>
                  <button
                    onClick={discardRecording}
                    disabled={uploadingVideo}
                    className="p-2 rounded-full bg-slate-700 hover:bg-slate-600 text-white transition-colors"
                    title="Discard"
                  >
                    <VideoOff size={16} />
                  </button>
                </>
              )}
              {uploadingVideo && <span className="text-[10px] text-indigo-300">Saving...</span>}
              {videoUploadError && <span className="text-[10px] text-red-300">{videoUploadError}</span>}
            </div>
          )}

          {/* Answer timer ring (compact, in controls bar) */}
          {isAnswerTimerActive && (
            <div className="shrink-0">
              <svg width="28" height="28" viewBox="0 0 28 28">
                <circle cx="14" cy="14" r="11" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5" />
                <circle cx="14" cy="14" r="11" fill="none"
                  stroke={answerTimeLeft <= 15 ? "#ef4444" : "#6366f1"}
                  strokeWidth="2.5" strokeLinecap="round"
                  strokeDasharray={`${answerTimerProgress * 69.12} 69.12`}
                  transform="rotate(-90 14 14)"
                  style={{ transition: "stroke-dasharray 1s linear" }}
                />
                <text x="14" y="14" textAnchor="middle" dominantBaseline="central"
                  className={`text-[7px] font-bold ${answerTimeLeft <= 15 ? "fill-red-400" : "fill-white"}`}
                >{answerTimeLeft}</text>
              </svg>
            </div>
          )}

          {/* Voice-first mic button OR text input */}
          {micMode && !isMicListening ? (
            <div className="flex-1 flex items-center justify-center gap-3">
              <button
                onClick={startMicListening}
                disabled={loading}
                className="p-4 rounded-full bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-700 text-white transition-all hover:scale-105 active:scale-95 shadow-lg shadow-indigo-500/20"
                title="Click to speak"
              >
                <Mic size={22} />
              </button>
              <button
                onClick={() => setMicMode(false)}
                className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors underline"
              >
                Type instead
              </button>
            </div>
          ) : micMode && isMicListening ? (
            <div className="flex-1 flex items-center gap-3">
              {/* Listening waveform */}
              <button
                onClick={() => {
                  const answer = micTranscriptRef.current.trim() || input.trim();
                  stopMicListening();
                  if (answer) {
                    setInput("");
                    micTranscriptRef.current = "";
                    const hasVideo = isVideoSavedForAnswer;
                    setIsVideoSavedForAnswer(false);
                    handleSendMessage(answer, false, hasVideo, true);
                  }
                }}
                className="p-3 rounded-full bg-red-500 hover:bg-red-600 text-white transition-all animate-pulse shadow-lg shadow-red-500/20"
                title="Stop & Submit"
              >
                <MicOff size={18} />
              </button>
              <div className="flex-1 flex items-center gap-1.5 px-3 py-2 bg-slate-800/60 border border-red-500/30 rounded-full">
                {/* Mini waveform */}
                <div className="flex items-end gap-[2px]">
                  {[8, 14, 10, 16, 8, 12, 6].map((h, i) => (
                    <div key={i} className="w-[2px] bg-red-400 rounded-full animate-pulse" style={{ height: `${h}px`, animationDelay: `${i * 0.1}s` }} />
                  ))}
                </div>
                <p className="text-xs text-slate-300 truncate flex-1">{input || "Listening..."}</p>
              </div>
            </div>
          ) : (
            /* Text input mode */
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const answer = (transcriptDraft || input).trim();
                if (!answer) return;
                const hasVideo = isVideoSavedForAnswer;
                setInput("");
                setTranscriptDraft("");
                setIsVideoSavedForAnswer(false);
                handleSendMessage(answer, false, hasVideo);
              }}
              className="flex-1 relative flex items-center gap-2"
            >
              <button
                type="button"
                onClick={() => setMicMode(true)}
                className="p-2 rounded-full bg-slate-800/60 hover:bg-slate-700/60 text-slate-400 hover:text-white transition-colors"
                title="Switch to voice"
              >
                <Mic size={16} />
              </button>
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={transcriptDraft || input}
                  onChange={(e) => {
                    setTranscriptDraft("");
                    setInput(e.target.value);
                  }}
                  disabled={loading}
                  placeholder="Type your answer..."
                  className="w-full bg-slate-800/60 border border-slate-700/50 text-white text-sm rounded-full pl-4 pr-11 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all disabled:opacity-40"
                />
                <button
                  type="submit"
                  disabled={!(transcriptDraft || input).trim() || loading}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-700 text-white rounded-full transition-colors"
                >
                  <Send size={14} className="ml-0.5" />
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      </div>{/* end main content */}
    </div>
  );
}
