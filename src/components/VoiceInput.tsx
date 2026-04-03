import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Keyboard, AlertCircle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface VoiceInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const LANG_TO_BCP47: Record<string, string> = {
  en: 'en-US', hi: 'hi-IN', ta: 'ta-IN', te: 'te-IN', bn: 'bn-IN',
  mr: 'mr-IN', gu: 'gu-IN', kn: 'kn-IN', ml: 'ml-IN', pa: 'pa-IN',
};

const VoiceInput = ({ value, onChange, placeholder, className }: VoiceInputProps) => {
  const { t, language } = useLanguage();
  const [isRecording, setIsRecording] = useState(false);
  const [inputMode, setInputMode] = useState<'text' | 'voice'>('text');
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Keep stable refs for value and onChange to avoid recreating SpeechRecognition
  const valueRef = useRef(value);
  useEffect(() => { valueRef.current = value; }, [value]);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  // Setup SpeechRecognition — recreate when language changes
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    let instance: SpeechRecognition | null = null;

    if (SpeechRecognition) {
      // Stop previous instance if it exists
      recognitionRef.current?.stop();

      instance = new SpeechRecognition();
      instance.lang = LANG_TO_BCP47[language] || 'en-US';
      instance.continuous = false;
      instance.interimResults = false;

      instance.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript.trim();
        if (transcript) {
          const current = valueRef.current;
          onChangeRef.current(current ? `${current} ${transcript}` : transcript);
        }
        setIsRecording(false);
      };

      instance.onerror = (event: SpeechRecognitionErrorEvent) => {
        setError(event.error === 'not-allowed'
          ? 'Microphone permission was denied. Please allow mic access.'
          : 'Voice capture error. Please try again.');
        setIsRecording(false);
      };

      instance.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = instance;
      setIsSupported(true);
    } else {
      setIsSupported(false);
    }

    return () => {
      instance?.stop();
    };
  }, [language]);

  const stopRecording = () => {
    recognitionRef.current?.stop();
    setIsRecording(false);
  };

  const toggleRecording = () => {
    if (!isSupported) {
      setError('Voice input is not supported in this browser. Please use text input.');
      return;
    }

    if (isRecording) {
      stopRecording();
    } else {
      setError(null);
      try {
        recognitionRef.current?.start();
        setIsRecording(true);
      } catch (err) {
        setError('Could not start recording. Please try again.');
        setIsRecording(false);
      }
    }
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant={inputMode === 'text' ? 'default' : 'outline'}
          size="sm"
          onClick={() => {
            setInputMode('text');
            if (isRecording) stopRecording();
          }}
          className="flex-1"
        >
          <Keyboard className="w-4 h-4 mr-2" />
          {t('textInput')}
        </Button>
        <Button
          type="button"
          variant={inputMode === 'voice' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setInputMode('voice')}
          className="flex-1"
        >
          <Mic className="w-4 h-4 mr-2" />
          {t('voiceInput')}
        </Button>
      </div>

      {inputMode === 'voice' && !isSupported && (
        <div className="flex items-center gap-2 text-sm text-warning bg-warning/10 border border-warning/30 rounded-xl px-3 py-2">
          <AlertCircle className="w-4 h-4" />
          <span>Voice input is not supported in this browser. Please use text input.</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {inputMode === 'text' ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="input-calm min-h-[100px] resize-none"
        />
      ) : (
        <div className="flex flex-col items-center gap-4 py-6 bg-muted/30 rounded-2xl">
          <button
            type="button"
            onClick={toggleRecording}
            className={cn(
              'w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300',
              isRecording
                ? 'bg-destructive text-destructive-foreground animate-pulse-soft scale-110'
                : 'bg-primary text-primary-foreground hover:scale-105'
            )}
          >
            {isRecording ? (
              <MicOff className="w-8 h-8" />
            ) : (
              <Mic className="w-8 h-8" />
            )}
          </button>
          <p className="text-sm text-muted-foreground">
            {isRecording ? t('stopRecording') : t('startRecording')}
          </p>
          {value && (
            <div className="w-full px-4">
              <p className="text-sm text-foreground bg-background rounded-xl p-3">
                {value}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VoiceInput;
