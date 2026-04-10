import { endVoiceSession, startVoiceSession } from "@/lib/actions/session.actions";
import { ASSISTANT_ID, DEFAULT_VOICE, VOICE_SETTINGS } from "@/lib/constants";
import { IBook, Messages } from "@/types";
import { useAuth } from "@clerk/nextjs";
import { set } from "mongoose";
import { useEffect, useRef, useState } from "react";

import Vapi from '@vapi-ai/web'
import { getVoice } from "@/lib/utils";

export type CallStatus = "idle" | "connecting" | "starting" | "listening" | "thinking" | "speaking";

// Hook to manage the state and logic for VAPI interactions
const useLatestRef = <T>(value: T) => {
    const ref = useRef(value);
    useEffect(() => {
        ref.current = value;
    }, [value]);

    return ref;
};

const VAPI_API_KEY = process.env.NEXT_PUBLIC_VAPI_API_KEY;

let vapi: InstanceType<typeof Vapi>

function getVapi(){
    if(!vapi) {
        if (!VAPI_API_KEY) {
            throw new Error("VAPI API key is not set. Please set NEXT_PUBLIC_VAPI_API_KEY in your environment variables.");
        }

        vapi = new Vapi(VAPI_API_KEY);
    }

    return vapi;
}

export const useVapi = (book: IBook) => {
    const { userId } = useAuth();
    //ToDO: implement limits for users

    const [status, setStatus] = useState<CallStatus>("idle");
    const [messages, setMessages] = useState<Messages[]>([]);
    const [currentMessage, setCurrentMessage] = useState('');
    const [currentUserMessage, setCurrentUserMessage] = useState('')
    const [duration, setDuration] = useState(0);
    const [limitError, setLimitError] = useState<string | null>(null);

    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const StartTimerRef = useRef<NodeJS.Timeout | null>(null);
    const StopTimerRef = useRef<NodeJS.Timeout | null>(null);
    const sessionIdRef = useRef<string | null>(null);
    const isStoppingRef = useRef<boolean>(false);

    // Ref to hold the latest book value
    const bookRef = useLatestRef(book);


    const durationRef = useLatestRef(duration);
    const voice = book.persona || DEFAULT_VOICE;

    const isActive = status === "listening" || status === "speaking" || status === "starting";


    //** limits
    // Ref to hold the latest max duration value
    //const maxDurationRef = useLatestRef(limits.maxSesionMinutes * 60); // Convert minutes to seconds
    // const maxDurationSeconds
    // const remainingSeconds
    // const showTimeWarning


    // Set up Vapi event listeners
    useEffect(() => {
        const handlers = {
            'call-start': () => {
                isStoppingRef.current = false;
                setStatus('starting'); // AI speaks first, wait for it
                setCurrentMessage('');
                setCurrentUserMessage('');

                // Start duration timer
                startTimeRef.current = Date.now();
                setDuration(0);
                timerRef.current = setInterval(() => {
                    if (startTimeRef.current) {
                        const newDuration = Math.floor((Date.now() - startTimeRef.current) / TIMER_INTERVAL_MS);
                        setDuration(newDuration);

                        // Check duration limit
                        if (newDuration >= maxDurationRef.current) {
                            getVapi().stop();
                            setLimitError(
                                `Session time limit (${Math.floor(
                                    maxDurationRef.current / SECONDS_PER_MINUTE,
                                )} minutes) reached. Upgrade your plan for longer sessions.`,
                            );
                        }
                    }
                }, TIMER_INTERVAL_MS);
            },

            'call-end': () => {
                // Don't reset isStoppingRef here - delayed events may still fire
                setStatus('idle');
                setCurrentMessage('');
                setCurrentUserMessage('');

                // Stop timer
                if (timerRef.current) {
                    clearInterval(timerRef.current);
                    timerRef.current = null;
                }

                // End session tracking
                if (sessionIdRef.current) {
                    endVoiceSession(sessionIdRef.current, durationRef.current).catch((err) =>
                        console.error('Failed to end voice session:', err),
                    );
                    sessionIdRef.current = null;
                }

                startTimeRef.current = null;
            },

            'speech-start': () => {
                if (!isStoppingRef.current) {
                    setStatus('speaking');
                }
            },
            'speech-end': () => {
                if (!isStoppingRef.current) {
                    // After AI finishes speaking, user can talk
                    setStatus('listening');
                }
            },

            message: (message: {
                type: string;
                role: string;
                transcriptType: string;
                transcript: string;
            }) => {
                if (message.type !== 'transcript') return;

                // User finished speaking → AI is thinking
                if (message.role === 'user' && message.transcriptType === 'final') {
                    if (!isStoppingRef.current) {
                        setStatus('thinking');
                    }
                    setCurrentUserMessage('');
                }

                // Partial user transcript → show real-time typing
                if (message.role === 'user' && message.transcriptType === 'partial') {
                    setCurrentUserMessage(message.transcript);
                    return;
                }

                // Partial AI transcript → show word-by-word
                if (message.role === 'assistant' && message.transcriptType === 'partial') {
                    setCurrentMessage(message.transcript);
                    return;
                }

                // Final transcript → add to messages
                if (message.transcriptType === 'final') {
                    if (message.role === 'assistant') setCurrentMessage('');
                    if (message.role === 'user') setCurrentUserMessage('');

                    setMessages((prev) => {
                        const isDupe = prev.some(
                            (m) => m.role === message.role && m.content === message.transcript,
                        );
                        return isDupe ? prev : [...prev, { role: message.role, content: message.transcript }];
                    });
                }
            },

            error: (error: Error) => {
                console.error('Vapi error:', error);
                // Don't reset isStoppingRef here - delayed events may still fire
                setStatus('idle');
                setCurrentMessage('');
                setCurrentUserMessage('');

                // Stop timer on error
                if (timerRef.current) {
                    clearInterval(timerRef.current);
                    timerRef.current = null;
                }

                // End session tracking on error
                if (sessionIdRef.current) {
                    endVoiceSession(sessionIdRef.current, durationRef.current).catch((err) =>
                        console.error('Failed to end voice session on error:', err),
                    );
                    sessionIdRef.current = null;
                }

                // Show user-friendly error message
                const errorMessage = error.message?.toLowerCase() || '';
                if (errorMessage.includes('timeout') || errorMessage.includes('silence')) {
                    setLimitError('Session ended due to inactivity. Click the mic to start again.');
                } else if (errorMessage.includes('network') || errorMessage.includes('connection')) {
                    setLimitError('Connection lost. Please check your internet and try again.');
                } else {
                    setLimitError('Session ended unexpectedly. Click the mic to start again.');
                }

                startTimeRef.current = null;
            },
        };

        // Register all handlers
        Object.entries(handlers).forEach(([event, handler]) => {
            getVapi().on(event as keyof typeof handlers, handler as () => void);
        });

        return () => {
            // End active session on unmount
            if (sessionIdRef.current) {
                getVapi().stop();
                endVoiceSession(sessionIdRef.current, durationRef.current).catch((err) =>
                    console.error('Failed to end voice session on unmount:', err),
                );
                sessionIdRef.current = null;
            }
            // Cleanup handlers
            Object.entries(handlers).forEach(([event, handler]) => {
                getVapi().off(event as keyof typeof handlers, handler as () => void);
            });
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);
    
    const start = async () => {
        if (!userId) return setLimitError("Please login to start a conversation");

        setLimitError(null);
        setStatus("connecting");

        try {
            const result = await startVoiceSession(userId, book._id);

            if (!result.success) {
                setLimitError(result.error || 'Session limit reached. Please upgrade your plan.');
                setStatus("idle");
                return;
            }

            sessionIdRef.current = result.sessionId || null;

            const firstMessage = `Hey, good to meet you. Quick question, before we dive in: have you actually read
             ${book.title} yet? or are we startng fresh?`

             await getVapi().start(ASSISTANT_ID, {
                firstMessage,
                variableValues: {
                    title: book.title,
                    author: book.author,
                    bookId: book._id
                },
                // voice: {
                //     provider: '11labs' as const,
                //     voiceId: getVoice(voice).id,
                //     model: 'eleven_turbo_v2_5' as const,
                //     stability: VOICE_SETTINGS.stability,
                //     similarityBoost: VOICE_SETTINGS.similarityBoost,
                //     style: VOICE_SETTINGS.style,
                //     useSpeakerBoost: VOICE_SETTINGS.useSpeakerBoost,
                // }
             })
        } catch (e) {
            console.error('Error starting call:', e);
            setStatus("idle");
            setLimitError("An error occurred while starting the conversation. Please try again.");
        }
    }

    const stop = async () => {
        isStoppingRef.current = true;
        await getVapi().stop();
    }

    const clearErrors = async () => {}

    return {
        status,
        messages,
        currentMessage,
        currentUserMessage,
        duration,
        limitError,
        isActive,
        start,
        stop,
        clearErrors,
        // maxDurationSeconds,
        // remainingSeconds,
        // showTimeWarning,
        // duration,


    }

}

export default useVapi;