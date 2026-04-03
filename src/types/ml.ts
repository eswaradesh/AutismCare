
export interface DailyInputRequest {
  child_id: string;
  date: string;
  sleep_start?: string;
  sleep_end?: string;
  meals?: { time: string; type: string; notes?: string }[];
  activities?: { type: string; duration: number; notes?: string }[];
  emotions?: string[];
  behaviour_notes?: string;
  behaviour_intensity?: string;
  medication_taken?: boolean;
  voice_note_text?: string;
  language?: string;
}

export interface AnalysisResponse {
  anomaly_score: number;
  confidence: number;
  forecast: string;
  explanation: string;
  contributing_factors?: string[];
  alert?: any;
}

export interface InitializationRequest {
  child_id: string;
  historical_data: any[];
}

export interface InitializationResponse {
  child_id: string;
  status: string;
  message?: string;
  baseline?: any;
  models_fitted: string[];
}

export interface ForecastResponse {
  child_id: string;
  trend: string;
  trend_confidence: number;
  forecast_1_day: any;
  forecast_3_day: any;
  forecast_7_day: any;
  interpretation: string;
}
