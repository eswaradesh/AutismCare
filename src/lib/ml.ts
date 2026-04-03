
import {
    DailyInputRequest,
    AnalysisResponse,
    InitializationRequest,
    InitializationResponse,
    ForecastResponse
} from '../types/ml';

const ML_API_URL = import.meta.env.VITE_ML_API_URL || 'http://localhost:8001';

export const mlService = {
    async healthCheck() {
        try {
            const res = await fetch(`${ML_API_URL}/health`, {
                signal: AbortSignal.timeout(5000)
            });
            if (!res.ok) return null;
            return await res.json();
        } catch (error) {
            // Log less aggressively or handle timeout
            console.warn('ML Backend Offline or unreachable:', error);
            return null;
        }
    },

    async initializeChild(data: InitializationRequest): Promise<InitializationResponse> {
        const res = await fetch(`${ML_API_URL}/initialize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('ML Initialization failed');
        return res.json();
    },

    async initializeChildRaw(childId: string, routines: any[], behaviors: any[]): Promise<InitializationResponse> {
        const res = await fetch(`${ML_API_URL}/initialize_raw`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                child_id: childId,
                routine_entries: routines,
                behavior_entries: behaviors
            }),
            signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) throw new Error('ML Raw Initialization failed');
        return res.json();
    },

    async analyzeDailyEntry(data: DailyInputRequest): Promise<AnalysisResponse> {
        const res = await fetch(`${ML_API_URL}/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('ML Analysis failed');
        return res.json();
    },

    async getForecast(childId: string, historicalData: any[]): Promise<ForecastResponse> {
        const res = await fetch(`${ML_API_URL}/forecast/${childId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(historicalData),
        });
        if (!res.ok) throw new Error('ML Forecast failed');
        return res.json();
    },

    async getBaseline(childId: string) {
        const res = await fetch(`${ML_API_URL}/baseline/${childId}`);
        if (!res.ok) return null;
        return res.json();
    }
};
