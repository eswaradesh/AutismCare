"""
AutismCare Short-Term Behaviour Forecasting Engine
Predicts behavioral trends using ARIMA and Prophet models
"""

import numpy as np
import pandas as pd
from typing import Dict, Optional, List, Tuple, Any
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
import logging
import warnings

# Suppress statsmodels warnings
warnings.filterwarnings('ignore')

from config import PipelineConfig, ForecastConfig, ForecastModelType, get_config

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class ForecastPoint:
    """Single forecast point"""
    date: str
    predicted_value: float
    lower_bound: float  # Confidence interval
    upper_bound: float
    confidence: float


@dataclass
class BehaviourForecast:
    """Complete behavior forecast for a child"""
    child_id: str
    forecast_target: str  # behaviour_score
    
    # Forecast horizons
    forecast_1_day: ForecastPoint
    forecast_3_day: ForecastPoint
    forecast_7_day: ForecastPoint
    
    # Trend description (probability-based language)
    trend_description: str  # "likely_increase", "possible_stability", "may_reduce"
    trend_confidence: float
    
    # Interpretation
    interpretation: str  # Human-readable explanation
    
    # Model info
    model_used: str
    samples_used: int
    
    # Metadata
    created_at: str
    
    def to_dict(self) -> Dict:
        d = asdict(self)
        d["forecast_1_day"] = asdict(self.forecast_1_day)
        d["forecast_3_day"] = asdict(self.forecast_3_day)
        d["forecast_7_day"] = asdict(self.forecast_7_day)
        return d


@dataclass
class TrendAnalysis:
    """Analysis of behavioral trend direction"""
    trend_type: str  # "likely_increase", "possible_stability", "may_reduce"
    trend_slope: float
    trend_strength: str  # "strong", "moderate", "weak"
    confidence: float
    supporting_evidence: List[str]


class ARIMAForecaster:
    """
    Time-series forecasting using ARIMA
    Suitable for stationary behavioral patterns
    """
    
    def __init__(self, config: ForecastConfig = None):
        self.config = config or ForecastConfig()
        self.model = None
        self.is_fitted = False
        self.order = self.config.arima_order
        self.seasonal_order = self.config.seasonal_order
    
    def fit(self, time_series: pd.Series) -> bool:
        """
        Fit ARIMA model on time series data
        
        Args:
            time_series: Series with datetime index
        
        Returns:
            True if fitting successful
        """
        try:
            from statsmodels.tsa.arima.model import ARIMA
            
            if len(time_series) < 14:
                logger.warning("Insufficient data for ARIMA fitting")
                return False
            
            # Handle missing values
            time_series = time_series.ffill().bfill()
            
            # Fit ARIMA
            self.model = ARIMA(
                time_series,
                order=self.order
            )
            self.model_fit = self.model.fit()
            self.is_fitted = True
            
            return True
            
        except Exception as e:
            logger.error(f"ARIMA fitting failed: {e}")
            return False
    
    def forecast(
        self, 
        steps: int = 7
    ) -> List[Tuple[float, float, float]]:
        """
        Generate forecast
        
        Returns:
            List of (predicted, lower_ci, upper_ci)
        """
        if not self.is_fitted:
            raise ValueError("Model not fitted")
        
        try:
            # Get forecast
            forecast = self.model_fit.get_forecast(steps=steps)
            predictions = forecast.predicted_mean
            conf_int = forecast.conf_int(alpha=0.2)  # 80% CI
            
            results = []
            for i in range(len(predictions)):
                pred = predictions.iloc[i]
                lower = conf_int.iloc[i, 0]
                upper = conf_int.iloc[i, 1]
                
                # Clip to valid range
                pred = max(0, min(1, pred))
                lower = max(0, min(1, lower))
                upper = max(0, min(1, upper))
                
                results.append((pred, lower, upper))
            
            return results
            
        except Exception as e:
            logger.error(f"ARIMA forecast failed: {e}")
            return []


class ProphetForecaster:
    """
    Time-series forecasting using Facebook Prophet
    Better for handling seasonality and trends
    """
    
    def __init__(self, config: ForecastConfig = None):
        self.config = config or ForecastConfig()
        self.model = None
        self.is_fitted = False
    
    def fit(self, df: pd.DataFrame) -> bool:
        """
        Fit Prophet model
        
        Args:
            df: DataFrame with 'ds' (date) and 'y' (value) columns
        
        Returns:
            True if fitting successful
        """
        try:
            from prophet import Prophet
            
            if len(df) < 14:
                logger.warning("Insufficient data for Prophet fitting")
                return False
            
            # Prepare Prophet data format
            prophet_df = df[['ds', 'y']].copy()
            
            # Initialize Prophet with conservative settings
            self.model = Prophet(
                changepoint_prior_scale=self.config.changepoint_prior_scale,
                seasonality_mode=self.config.seasonality_mode,
                yearly_seasonality=False,
                weekly_seasonality=True,
                daily_seasonality=False,
                interval_width=0.8
            )
            
            # Fit
            self.model.fit(prophet_df)
            self.is_fitted = True
            
            return True
            
        except ImportError:
            logger.warning("Prophet not installed, falling back to ARIMA")
            return False
        except Exception as e:
            logger.error(f"Prophet fitting failed: {e}")
            return False
    
    def forecast(
        self, 
        periods: int = 7
    ) -> List[Tuple[float, float, float]]:
        """Generate forecast"""
        if not self.is_fitted:
            raise ValueError("Model not fitted")
        
        try:
            # Create future dataframe
            future = self.model.make_future_dataframe(periods=periods)
            
            # Predict
            forecast = self.model.predict(future)
            
            # Take only the forecast periods
            forecast = forecast.tail(periods)
            
            results = []
            for _, row in forecast.iterrows():
                pred = max(0, min(1, row['yhat']))
                lower = max(0, min(1, row['yhat_lower']))
                upper = max(0, min(1, row['yhat_upper']))
                results.append((pred, lower, upper))
            
            return results
            
        except Exception as e:
            logger.error(f"Prophet forecast failed: {e}")
            return []


class SimpleMovingAverageForecaster:
    """
    Fallback forecaster using simple moving average
    Used when ARIMA/Prophet are unavailable or fail
    """
    
    def __init__(self, window: int = 7):
        self.window = window
        self.series = None
        self.is_fitted = False
    
    def fit(self, time_series: pd.Series) -> bool:
        """Fit on time series data"""
        if len(time_series) < 3:
            return False
        
        self.series = time_series.ffill().bfill()
        self.is_fitted = True
        return True
    
    def forecast(self, steps: int = 7) -> List[Tuple[float, float, float]]:
        """Generate forecast using moving average"""
        if not self.is_fitted:
            raise ValueError("Model not fitted")
        
        # Calculate moving average and std
        window = min(self.window, len(self.series))
        recent = self.series.tail(window)
        
        mean_val = recent.mean()
        std_val = recent.std()
        
        # Apply slight decay toward mean
        results = []
        for i in range(steps):
            # Slight regression toward overall mean
            decay = 0.95 ** i
            pred = mean_val * decay + self.series.mean() * (1 - decay)
            
            # Wider confidence interval for further forecasts
            margin = std_val * (1 + i * 0.1)
            
            pred = max(0, min(1, pred))
            lower = max(0, pred - margin)
            upper = min(1, pred + margin)
            
            results.append((pred, lower, upper))
        
        return results


class ForecastEngine:
    """
    Main forecasting engine
    Orchestrates model selection and forecast generation
    """
    
    def __init__(self, config: PipelineConfig = None):
        self.config = config or get_config()
        self.forecast_config = self.config.forecast
        
        # Forecasters
        self.arima_forecaster = ARIMAForecaster(self.forecast_config)
        self.prophet_forecaster = ProphetForecaster(self.forecast_config)
        self.sma_forecaster = SimpleMovingAverageForecaster()
        
        # Active model
        self.active_model = self.forecast_config.model_type
        
        # Horizons
        self.horizons = self.forecast_config.horizons  # [1, 3, 7]
    
    def generate_forecast(
        self,
        child_id: str,
        data: pd.DataFrame,
        target: str = "behaviour_score"
    ) -> BehaviourForecast:
        """
        Generate behavior forecast for a child
        
        Args:
            child_id: Child identifier
            data: Historical data with date and target columns
            target: Column to forecast
        
        Returns:
            BehaviourForecast with predictions and interpretation
        """
        if target not in data.columns:
            raise ValueError(f"Target column '{target}' not found")
        
        # Prepare time series
        if "date" in data.columns:
            ts_data = data.set_index("date")[target].sort_index()
        else:
            ts_data = data[target]
        
        # Try to fit models in order of preference
        model_used = "simple_moving_average"
        forecaster = self.sma_forecaster
        
        if self.active_model == ForecastModelType.PROPHET:
            # Try Prophet first
            prophet_df = pd.DataFrame({
                'ds': pd.to_datetime(data['date']) if 'date' in data.columns else pd.date_range(end=datetime.now(), periods=len(data)),
                'y': data[target]
            })
            
            if self.prophet_forecaster.fit(prophet_df):
                forecaster = self.prophet_forecaster
                model_used = "prophet"
            else:
                # Fallback to ARIMA
                if self.arima_forecaster.fit(ts_data):
                    forecaster = self.arima_forecaster
                    model_used = "arima"
        else:
            # Try ARIMA first
            if self.arima_forecaster.fit(ts_data):
                forecaster = self.arima_forecaster
                model_used = "arima"
        
        # Fallback to SMA if needed
        if model_used == "simple_moving_average":
            self.sma_forecaster.fit(ts_data)
        
        # Generate forecasts
        max_horizon = max(self.horizons)
        forecasts = forecaster.forecast(max_horizon)
        
        if not forecasts:
            # Emergency fallback
            last_value = ts_data.iloc[-1] if len(ts_data) > 0 else 0.5
            forecasts = [(last_value, last_value - 0.1, last_value + 0.1)] * max_horizon
        
        # Get base date
        if "date" in data.columns:
            last_date = pd.to_datetime(data["date"]).max()
        else:
            last_date = datetime.now()
        
        # Create forecast points
        def make_forecast_point(horizon: int) -> ForecastPoint:
            idx = horizon - 1
            pred, lower, upper = forecasts[idx] if idx < len(forecasts) else forecasts[-1]
            
            forecast_date = last_date + timedelta(days=horizon)
            
            # Confidence decreases with horizon
            base_confidence = 0.85
            decay = 0.95 ** (horizon - 1)
            confidence = base_confidence * decay
            
            return ForecastPoint(
                date=forecast_date.strftime("%Y-%m-%d"),
                predicted_value=round(pred, 3),
                lower_bound=round(lower, 3),
                upper_bound=round(upper, 3),
                confidence=round(confidence, 2)
            )
        
        forecast_1 = make_forecast_point(1)
        forecast_3 = make_forecast_point(3)
        forecast_7 = make_forecast_point(7)
        
        # Analyze trend
        trend = self._analyze_trend(ts_data, forecasts)
        
        # Generate interpretation
        interpretation = self._generate_interpretation(
            trend, forecast_1, forecast_7, model_used
        )
        
        return BehaviourForecast(
            child_id=child_id,
            forecast_target=target,
            forecast_1_day=forecast_1,
            forecast_3_day=forecast_3,
            forecast_7_day=forecast_7,
            trend_description=trend.trend_type,
            trend_confidence=trend.confidence,
            interpretation=interpretation,
            model_used=model_used,
            samples_used=len(data),
            created_at=datetime.now().isoformat()
        )
    
    def _analyze_trend(
        self, 
        historical: pd.Series,
        forecasts: List[Tuple[float, float, float]]
    ) -> TrendAnalysis:
        """Analyze trend direction and strength"""
        
        # Calculate recent slope
        if len(historical) >= 7:
            recent = historical.tail(7)
            x = np.arange(len(recent))
            slope = np.polyfit(x, recent.values, 1)[0]
        else:
            slope = 0
        
        # Calculate forecast slope
        if len(forecasts) >= 3:
            forecast_vals = [f[0] for f in forecasts[:7]]
            x = np.arange(len(forecast_vals))
            forecast_slope = np.polyfit(x, forecast_vals, 1)[0]
        else:
            forecast_slope = 0
        
        # Combined slope
        combined_slope = 0.4 * slope + 0.6 * forecast_slope
        
        # Determine trend type (probability-based language)
        if combined_slope > 0.02:
            trend_type = "likely_increase"
            strength = "strong" if combined_slope > 0.05 else "moderate"
        elif combined_slope < -0.02:
            trend_type = "may_reduce"
            strength = "strong" if combined_slope < -0.05 else "moderate"
        else:
            trend_type = "possible_stability"
            strength = "weak"
        
        # Calculate confidence
        variance = historical.std() if len(historical) > 1 else 0.5
        consistency = max(0.3, 1 - variance)
        confidence = consistency * 0.7 + (len(historical) / 60) * 0.3
        confidence = min(0.9, confidence)
        
        # Evidence
        evidence = []
        if len(historical) >= 14:
            evidence.append("Two weeks of historical data available")
        if abs(combined_slope) > 0.02:
            evidence.append(f"Consistent {'upward' if combined_slope > 0 else 'downward'} pattern observed")
        if variance < 0.2:
            evidence.append("Low variability in recent patterns")
        
        return TrendAnalysis(
            trend_type=trend_type,
            trend_slope=round(combined_slope, 4),
            trend_strength=strength,
            confidence=round(confidence, 2),
            supporting_evidence=evidence
        )
    
    def _generate_interpretation(
        self,
        trend: TrendAnalysis,
        forecast_1: ForecastPoint,
        forecast_7: ForecastPoint,
        model_used: str
    ) -> str:
        """Generate human-readable interpretation"""
        
        interpretations = []
        
        # Trend description
        trend_descs = {
            "likely_increase": "Behavioral patterns suggest a possible positive trend",
            "possible_stability": "Behavioral patterns appear relatively stable",
            "may_reduce": "Behavioral patterns may show some variation"
        }
        
        interpretations.append(
            f"{trend_descs.get(trend.trend_type, 'Patterns are being monitored')} "
            f"with {int(trend.confidence * 100)}% confidence."
        )
        
        # Short-term outlook
        if forecast_1.predicted_value > 0.6:
            interpretations.append(
                "Tomorrow's outlook suggests likely calm behavioral patterns."
            )
        elif forecast_1.predicted_value < 0.4:
            interpretations.append(
                "Tomorrow may require additional support and monitoring."
            )
        else:
            interpretations.append(
                "Tomorrow's patterns are expected to be within typical range."
            )
        
        # Weekly outlook
        change = forecast_7.predicted_value - forecast_1.predicted_value
        if abs(change) > 0.1:
            direction = "improvement" if change > 0 else "variation"
            interpretations.append(
                f"Weekly outlook suggests possible {direction} in patterns."
            )
        
        # Confidence qualifier
        if trend.confidence < 0.6:
            interpretations.append(
                "Note: Forecast confidence is limited due to data variability."
            )
        
        return " ".join(interpretations)
    
    def switch_model(self, model_type: ForecastModelType):
        """Switch the active forecast model"""
        self.active_model = model_type
        logger.info(f"Switched to {model_type.value} forecasting")
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get information about current model configuration"""
        return {
            "active_model": self.active_model.value,
            "horizons": self.horizons,
            "arima_order": self.forecast_config.arima_order
        }


# Example usage
if __name__ == "__main__":
    np.random.seed(42)
    
    # Create sample time series data with trend
    n_days = 30
    dates = pd.date_range(end=datetime.now(), periods=n_days)
    
    # Simulated behavior with slight upward trend
    base = 0.5
    trend = np.linspace(0, 0.1, n_days)
    noise = np.random.normal(0, 0.05, n_days)
    weekly_pattern = 0.05 * np.sin(np.arange(n_days) * 2 * np.pi / 7)
    
    behavior = base + trend + noise + weekly_pattern
    behavior = np.clip(behavior, 0, 1)
    
    df = pd.DataFrame({
        "child_id": ["child_1"] * n_days,
        "date": dates.strftime("%Y-%m-%d"),
        "behaviour_score": behavior
    })
    
    # Generate forecast
    engine = ForecastEngine()
    forecast = engine.generate_forecast("child_1", df)
    
    print(f"Behaviour Forecast for child_1:")
    print(f"  Model: {forecast.model_used}")
    print(f"  Trend: {forecast.trend_description}")
    print(f"  Trend Confidence: {forecast.trend_confidence:.0%}")
    
    print(f"\n  1-Day Forecast:")
    print(f"    Date: {forecast.forecast_1_day.date}")
    print(f"    Predicted: {forecast.forecast_1_day.predicted_value:.3f}")
    print(f"    Range: [{forecast.forecast_1_day.lower_bound:.3f}, {forecast.forecast_1_day.upper_bound:.3f}]")
    print(f"    Confidence: {forecast.forecast_1_day.confidence:.0%}")
    
    print(f"\n  7-Day Forecast:")
    print(f"    Date: {forecast.forecast_7_day.date}")
    print(f"    Predicted: {forecast.forecast_7_day.predicted_value:.3f}")
    print(f"    Range: [{forecast.forecast_7_day.lower_bound:.3f}, {forecast.forecast_7_day.upper_bound:.3f}]")
    print(f"    Confidence: {forecast.forecast_7_day.confidence:.0%}")
    
    print(f"\nInterpretation: {forecast.interpretation}")
