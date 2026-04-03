"""
AutismCare Routine-Behaviour Correlation Engine
Analyzes relationships between routines and behavioral outcomes
"""

import numpy as np
import pandas as pd
from typing import Dict, Optional, List, Tuple, Any
from dataclasses import dataclass, asdict
from datetime import datetime
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import cross_val_score
from sklearn.inspection import permutation_importance
import logging

from config import PipelineConfig, CorrelationConfig, get_config

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class FeatureImportance:
    """Importance of a feature in predicting behavior"""
    feature_name: str
    importance_score: float  # 0-1 normalized
    importance_percentage: float  # Contribution percentage
    coefficient: Optional[float]  # For linear models
    direction: str  # "positive", "negative", "neutral"
    interpretation: str  # Human-readable explanation
    confidence: float


@dataclass
class CorrelationAnalysis:
    """Complete correlation analysis for a child"""
    child_id: str
    target: str  # What we're predicting (behaviour_score)
    
    # Feature importances
    feature_importances: List[FeatureImportance]
    
    # Model performance
    model_type: str
    r_squared: float
    cross_val_score: float
    
    # Key insights
    top_influencing_factor: str
    summary_explanation: str
    
    # Metadata
    samples_used: int
    created_at: str
    confidence: float
    
    def to_dict(self) -> Dict:
        d = asdict(self)
        d["feature_importances"] = [asdict(fi) for fi in self.feature_importances]
        return d


@dataclass
class CorrelationInsight:
    """Single insight about routine-behavior relationship"""
    factor: str
    influence_strength: str  # "strong", "moderate", "weak"
    influence_type: str  # "positive", "negative"
    explanation: str
    action_suggestion: Optional[str]


class LinearCorrelationAnalyzer:
    """
    Analyze correlations using Linear Regression
    Provides interpretable coefficients
    """
    
    def __init__(self, config: CorrelationConfig = None):
        self.config = config or CorrelationConfig()
        self.model = None
        self.scaler = StandardScaler()
        self.is_fitted = False
        self.feature_names: List[str] = []
    
    def fit(
        self, 
        X: pd.DataFrame, 
        y: pd.Series,
        feature_cols: List[str]
    ) -> Dict[str, Any]:
        """
        Fit linear regression model
        
        Returns:
            Dictionary with coefficients and R² score
        """
        self.feature_names = feature_cols
        
        X_features = X[feature_cols].values
        y_values = y.values
        
        if len(X_features) < self.config.min_samples:
            logger.warning(
                f"Insufficient samples: {len(X_features)} < {self.config.min_samples}"
            )
            return {}
        
        # Scale features
        X_scaled = self.scaler.fit_transform(X_features)
        
        # Use Ridge regression for stability
        self.model = Ridge(alpha=1.0)
        self.model.fit(X_scaled, y_values)

        # Calculate R² using cross-validation to avoid data leakage
        cv_scores = cross_val_score(self.model, X_scaled, y_values, cv=min(5, len(X_scaled)), scoring='r2')
        r_squared = max(0, float(np.mean(cv_scores)))

        # Cross-validation score
        cv_score = r_squared
        
        self.is_fitted = True
        
        return {
            "coefficients": dict(zip(self.feature_names, self.model.coef_)),
            "intercept": self.model.intercept_,
            "r_squared": r_squared,
            "cv_score": cv_score
        }
    
    def get_feature_importances(self) -> List[Tuple[str, float, float]]:
        """
        Get feature importances from coefficients
        
        Returns:
            List of (feature_name, importance, coefficient)
        """
        if not self.is_fitted:
            return []
        
        # Use absolute coefficients as importance
        abs_coefs = np.abs(self.model.coef_)
        total = np.sum(abs_coefs)
        
        if total == 0:
            return [(name, 0.0, 0.0) for name in self.feature_names]
        
        importances = []
        for name, coef in zip(self.feature_names, self.model.coef_):
            importance = abs(coef) / total
            importances.append((name, importance, coef))
        
        return sorted(importances, key=lambda x: x[1], reverse=True)


class RandomForestCorrelationAnalyzer:
    """
    Analyze correlations using Random Forest
    Provides feature importance and handles non-linear relationships
    """
    
    def __init__(self, config: CorrelationConfig = None):
        self.config = config or CorrelationConfig()
        self.model = None
        self.scaler = StandardScaler()
        self.is_fitted = False
        self.feature_names: List[str] = []
    
    def fit(
        self, 
        X: pd.DataFrame, 
        y: pd.Series,
        feature_cols: List[str]
    ) -> Dict[str, Any]:
        """Fit Random Forest model"""
        self.feature_names = feature_cols
        
        X_features = X[feature_cols].values
        y_values = y.values
        
        if len(X_features) < self.config.min_samples:
            logger.warning(
                f"Insufficient samples: {len(X_features)} < {self.config.min_samples}"
            )
            return {}
        
        # Scale features
        X_scaled = self.scaler.fit_transform(X_features)
        
        # Fit Random Forest
        self.model = RandomForestRegressor(
            n_estimators=self.config.n_estimators_rf,
            max_depth=5,  # Limit depth for interpretability
            random_state=42
        )
        self.model.fit(X_scaled, y_values)

        # Calculate R² using cross-validation to avoid data leakage
        cv_scores = cross_val_score(self.model, X_scaled, y_values, cv=min(5, len(X_scaled)), scoring='r2')
        r_squared = max(0, float(np.mean(cv_scores)))

        # Cross-validation score
        cv_score = r_squared
        
        # Permutation importance
        perm_importance = permutation_importance(
            self.model, X_scaled, y_values, 
            n_repeats=10, random_state=42
        )
        
        self.perm_importances = dict(
            zip(self.feature_names, perm_importance.importances_mean)
        )
        
        self.is_fitted = True
        
        return {
            "feature_importances": dict(zip(self.feature_names, self.model.feature_importances_)),
            "permutation_importances": self.perm_importances,
            "r_squared": r_squared,
            "cv_score": cv_score
        }
    
    def get_feature_importances(self) -> List[Tuple[str, float, Optional[float]]]:
        """Get feature importances"""
        if not self.is_fitted:
            return []
        
        importances = self.model.feature_importances_
        total = np.sum(importances)
        
        if total == 0:
            return [(name, 0.0, None) for name in self.feature_names]
        
        result = []
        for name, imp in zip(self.feature_names, importances):
            normalized = imp / total
            perm_imp = self.perm_importances.get(name, 0)
            result.append((name, normalized, perm_imp))
        
        return sorted(result, key=lambda x: x[1], reverse=True)


class CorrelationEngine:
    """
    Main correlation analysis engine
    Combines linear and RF analysis for comprehensive insights
    """
    
    def __init__(self, config: PipelineConfig = None):
        self.config = config or get_config()
        self.corr_config = self.config.correlation
        
        self.linear_analyzer = LinearCorrelationAnalyzer(self.corr_config)
        self.rf_analyzer = RandomForestCorrelationAnalyzer(self.corr_config)
        
        # Feature to predict
        self.target_col = "behaviour_score"
        
        # Input features
        self.feature_cols = ["sleep_hours", "activity_level", 
                            "emotion_score", "medication_flag"]
        
        # Stored analyses per child
        self.analyses: Dict[str, CorrelationAnalysis] = {}
    
    def analyze_correlations(
        self,
        child_id: str,
        data: pd.DataFrame,
        target: str = None
    ) -> CorrelationAnalysis:
        """
        Analyze routine-behavior correlations for a child
        
        Args:
            child_id: Child identifier
            data: Historical data with features and target
            target: Target column (default: behaviour_score)
        
        Returns:
            CorrelationAnalysis with feature importances and insights
        """
        target = target or self.target_col
        
        if target not in data.columns:
            raise ValueError(f"Target column '{target}' not found in data")
        
        # Filter valid features
        available_features = [f for f in self.feature_cols if f in data.columns]
        
        if len(available_features) == 0:
            raise ValueError("No valid feature columns found")
        
        X = data[available_features]
        y = data[target]
        
        # Fit both models
        linear_results = self.linear_analyzer.fit(X, y, available_features)
        rf_results = self.rf_analyzer.fit(X, y, available_features)
        
        # Choose primary model based on config
        if self.corr_config.use_random_forest:
            primary_importances = self.rf_analyzer.get_feature_importances()
            model_type = "random_forest"
            r_squared = rf_results.get("r_squared", 0)
            cv_score = rf_results.get("cv_score", 0)
        else:
            primary_importances = self.linear_analyzer.get_feature_importances()
            model_type = "linear_regression"
            r_squared = linear_results.get("r_squared", 0)
            cv_score = linear_results.get("cv_score", 0)
        
        # Create FeatureImportance objects
        feature_importances = []
        linear_coefs = linear_results.get("coefficients", {})
        
        for feature, importance, extra in primary_importances:
            coef = linear_coefs.get(feature, 0)
            
            # Determine direction
            if coef > 0.01:
                direction = "positive"
            elif coef < -0.01:
                direction = "negative"
            else:
                direction = "neutral"
            
            # Generate interpretation
            interpretation = self._interpret_feature(
                feature, importance * 100, direction, target
            )
            
            fi = FeatureImportance(
                feature_name=feature,
                importance_score=round(importance, 3),
                importance_percentage=round(importance * 100, 1),
                coefficient=round(coef, 3) if coef else None,
                direction=direction,
                interpretation=interpretation,
                confidence=round(min(0.95, r_squared + 0.3), 2)
            )
            feature_importances.append(fi)
        
        # Get top factor
        top_factor = feature_importances[0].feature_name if feature_importances else "unknown"
        top_pct = feature_importances[0].importance_percentage if feature_importances else 0
        
        # Generate summary
        summary = self._generate_summary(feature_importances, target, r_squared)
        
        # Calculate overall confidence
        confidence = min(0.95, 0.4 + r_squared * 0.4 + (len(data) / 100) * 0.2)
        
        analysis = CorrelationAnalysis(
            child_id=child_id,
            target=target,
            feature_importances=feature_importances,
            model_type=model_type,
            r_squared=round(r_squared, 3),
            cross_val_score=round(cv_score, 3),
            top_influencing_factor=f"{top_factor} ({top_pct:.1f}%)",
            summary_explanation=summary,
            samples_used=len(data),
            created_at=datetime.now().isoformat(),
            confidence=round(confidence, 2)
        )
        
        # Store
        self.analyses[child_id] = analysis
        
        return analysis
    
    def _interpret_feature(
        self, 
        feature: str, 
        importance_pct: float,
        direction: str,
        target: str
    ) -> str:
        """Generate human-readable interpretation of feature importance"""
        
        feature_descriptions = {
            "sleep_hours": "sleep duration",
            "activity_level": "activity level",
            "emotion_score": "emotional state",
            "medication_flag": "medication schedule"
        }
        
        feature_desc = feature_descriptions.get(feature, feature)
        
        # Strength description
        if importance_pct >= 40:
            strength = "strongly"
        elif importance_pct >= 20:
            strength = "moderately"
        else:
            strength = "slightly"
        
        # Direction interpretation
        if target == "behaviour_score":
            target_desc = "behavioral calmness"
        else:
            target_desc = target.replace("_", " ")
        
        if direction == "positive":
            relationship = f"Higher {feature_desc} tends to be associated with greater {target_desc}."
        elif direction == "negative":
            relationship = f"Higher {feature_desc} tends to be associated with lower {target_desc}."
        else:
            relationship = f"{feature_desc.capitalize()} shows variable relationship with {target_desc}."
        
        return f"{feature_desc.capitalize()} {strength} contributes ({importance_pct:.0f}%). {relationship}"
    
    def _generate_summary(
        self, 
        importances: List[FeatureImportance],
        target: str,
        r_squared: float
    ) -> str:
        """Generate summary explanation of correlations"""
        if not importances:
            return "Insufficient data to determine correlations."
        
        # Take top 3 factors
        top_factors = importances[:3]
        
        explanations = []
        
        for i, fi in enumerate(top_factors):
            if fi.importance_percentage >= 10:
                if i == 0:
                    explanations.append(
                        f"{fi.feature_name.replace('_', ' ').title()} appears to be the "
                        f"primary factor ({fi.importance_percentage:.0f}% influence)"
                    )
                else:
                    explanations.append(
                        f"followed by {fi.feature_name.replace('_', ' ')} "
                        f"({fi.importance_percentage:.0f}%)"
                    )
        
        if not explanations:
            return "No single factor shows dominant influence on behavioral patterns."
        
        summary = ", ".join(explanations) + "."
        
        # Add confidence qualifier
        if r_squared < 0.3:
            summary += " Note: Correlation patterns show high variability; interpret with caution."
        elif r_squared > 0.7:
            summary += " These patterns show consistent relationships in the observed data."
        
        return summary
    
    def get_insights(self, child_id: str) -> List[CorrelationInsight]:
        """
        Get actionable insights from correlation analysis
        """
        analysis = self.analyses.get(child_id)
        if not analysis:
            return []
        
        insights = []
        
        for fi in analysis.feature_importances[:3]:
            # Determine strength
            if fi.importance_percentage >= 30:
                strength = "strong"
            elif fi.importance_percentage >= 15:
                strength = "moderate"
            else:
                strength = "weak"
            
            # Generate action suggestion
            action = self._generate_action(fi.feature_name, fi.direction, strength)
            
            insight = CorrelationInsight(
                factor=fi.feature_name,
                influence_strength=strength,
                influence_type=fi.direction,
                explanation=fi.interpretation,
                action_suggestion=action
            )
            insights.append(insight)
        
        return insights
    
    def _generate_action(
        self, 
        feature: str, 
        direction: str,
        strength: str
    ) -> Optional[str]:
        """Generate action suggestion based on feature relationship"""
        
        if strength == "weak":
            return None  # Don't suggest actions for weak relationships
        
        actions = {
            ("sleep_hours", "positive"): 
                "Consider maintaining consistent sleep schedules; "
                "adequate rest may support calmer behavioral patterns.",
            
            ("sleep_hours", "negative"):
                "Monitor sleep patterns; unusually long or short sleep "
                "may correlate with behavioral changes.",
            
            ("activity_level", "positive"):
                "Regular physical activities might help support "
                "positive behavioral patterns.",
            
            ("activity_level", "negative"):
                "Balance activity levels; overstimulation may "
                "sometimes correlate with behavioral fluctuations.",
            
            ("emotion_score", "positive"):
                "Activities that support positive emotional states "
                "may help maintain behavioral stability.",
            
            ("medication_flag", "positive"):
                "Consistent medication schedules appear to correlate "
                "with more stable behavioral patterns."
        }
        
        return actions.get((feature, direction))
    
    def compare_multiple_children(
        self,
        analyses: Dict[str, CorrelationAnalysis]
    ) -> Dict[str, Any]:
        """
        Compare correlation patterns across multiple children
        Useful for population-level insights
        """
        if len(analyses) < 2:
            return {}
        
        # Aggregate feature importances
        feature_totals = {}
        feature_counts = {}
        
        for analysis in analyses.values():
            for fi in analysis.feature_importances:
                if fi.feature_name not in feature_totals:
                    feature_totals[fi.feature_name] = 0
                    feature_counts[fi.feature_name] = 0
                
                feature_totals[fi.feature_name] += fi.importance_percentage
                feature_counts[fi.feature_name] += 1
        
        # Calculate averages
        avg_importances = {
            name: total / feature_counts[name]
            for name, total in feature_totals.items()
        }
        
        # Sort by average importance
        sorted_features = sorted(
            avg_importances.items(), 
            key=lambda x: x[1], 
            reverse=True
        )
        
        return {
            "children_analyzed": len(analyses),
            "average_feature_importance": dict(sorted_features),
            "most_common_top_factor": sorted_features[0][0] if sorted_features else None,
            "average_r_squared": np.mean([a.r_squared for a in analyses.values()])
        }


# Example usage
if __name__ == "__main__":
    np.random.seed(42)
    
    # Create sample data with intentional correlations
    n_samples = 60
    
    # Sleep positively correlates with behavior
    sleep = np.random.normal(8, 1, n_samples)
    activity = np.random.uniform(0.3, 0.7, n_samples)
    emotion = np.random.uniform(0.4, 0.8, n_samples)
    medication = np.random.randint(0, 2, n_samples)
    
    # Behavior is influenced by sleep and emotion
    behavior = (
        0.3 * (sleep / 10) + 
        0.2 * activity + 
        0.4 * emotion + 
        0.1 * medication +
        np.random.normal(0, 0.05, n_samples)
    )
    behavior = np.clip(behavior, 0, 1)
    
    df = pd.DataFrame({
        "child_id": ["child_1"] * n_samples,
        "sleep_hours": sleep,
        "activity_level": activity,
        "emotion_score": emotion,
        "medication_flag": medication,
        "behaviour_score": behavior
    })
    
    # Analyze
    engine = CorrelationEngine()
    analysis = engine.analyze_correlations("child_1", df)
    
    print("Correlation Analysis for child_1:")
    print(f"  Model: {analysis.model_type}")
    print(f"  R²: {analysis.r_squared}")
    print(f"  Top Factor: {analysis.top_influencing_factor}")
    print(f"  Confidence: {analysis.confidence:.0%}")
    
    print("\nFeature Importances:")
    for fi in analysis.feature_importances:
        print(f"  {fi.feature_name}: {fi.importance_percentage:.1f}%")
        print(f"    Direction: {fi.direction}")
        print(f"    Interpretation: {fi.interpretation}")
    
    print(f"\nSummary: {analysis.summary_explanation}")
    
    # Get insights
    insights = engine.get_insights("child_1")
    print("\nActionable Insights:")
    for insight in insights:
        if insight.action_suggestion:
            print(f"  - {insight.action_suggestion}")
