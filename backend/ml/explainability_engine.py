"""
AutismCare Explainable AI Layer
Provides human-readable explanations using SHAP and Decision Trees
"""

import numpy as np
import pandas as pd
from typing import Dict, Optional, List, Tuple, Any
from dataclasses import dataclass, asdict
from datetime import datetime
import logging

from config import PipelineConfig, ExplainabilityConfig, EthicsConfig, get_config

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class FeatureContribution:
    """Contribution of a single feature to prediction"""
    feature_name: str
    feature_value: float
    shap_value: float
    contribution_direction: str  # "increases", "decreases"
    contribution_magnitude: str  # "strongly", "moderately", "slightly"
    natural_language: str  # Human-readable explanation


@dataclass 
class ExplanationOutput:
    """Complete explanation for a prediction"""
    child_id: str
    prediction_type: str  # "anomaly", "forecast", "correlation"
    prediction_value: float
    
    # Feature contributions
    feature_contributions: List[FeatureContribution]
    
    # Main explanation
    primary_explanation: str
    secondary_explanations: List[str]
    
    # Confidence and caveats
    confidence: float
    caveats: List[str]
    
    # Ethics compliance
    disclaimer: str
    
    # Metadata
    explanation_method: str  # "shap", "decision_tree", "rule_based"
    created_at: str
    
    def to_dict(self) -> Dict:
        d = asdict(self)
        d["feature_contributions"] = [asdict(fc) for fc in self.feature_contributions]
        return d


@dataclass
class DecisionPath:
    """Path through decision tree"""
    node_decisions: List[str]  # List of decision rules
    final_prediction: float
    path_confidence: float


class SHAPExplainer:
    """
    SHAP-based explanations for model predictions
    Provides local feature attributions
    """
    
    def __init__(self, config: ExplainabilityConfig = None):
        self.config = config or ExplainabilityConfig()
        self.explainer = None
        self.is_initialized = False
        self.feature_names: List[str] = []
        self.background_data = None
    
    def initialize(
        self, 
        model: Any,
        background_data: pd.DataFrame,
        feature_cols: List[str]
    ) -> bool:
        """
        Initialize SHAP explainer with model and background data
        
        Args:
            model: Trained sklearn model
            background_data: Sample data for background distribution
            feature_cols: Feature column names
        
        Returns:
            True if initialization successful
        """
        try:
            import shap
            
            self.feature_names = feature_cols
            
            # Sample background data
            max_samples = min(self.config.max_shap_samples, len(background_data))
            sample = background_data[feature_cols].sample(n=max_samples, random_state=42)
            self.background_data = sample
            
            # Create explainer based on model type
            model_type = type(model).__name__
            
            if 'RandomForest' in model_type or 'Tree' in model_type:
                self.explainer = shap.TreeExplainer(model)
            else:
                # Use KernelExplainer for other models
                self.explainer = shap.KernelExplainer(
                    model.predict, 
                    sample.values
                )
            
            self.is_initialized = True
            logger.info(f"SHAP explainer initialized for {model_type}")
            
            return True
            
        except ImportError:
            logger.warning("SHAP not installed")
            return False
        except Exception as e:
            logger.error(f"SHAP initialization failed: {e}")
            return False
    
    def explain(
        self, 
        observation: Dict[str, float]
    ) -> List[Tuple[str, float]]:
        """
        Get SHAP values for a single observation
        
        Returns:
            List of (feature_name, shap_value) sorted by importance
        """
        if not self.is_initialized:
            return []
        
        try:
            # Prepare input
            X = np.array([[observation.get(f, 0.5) for f in self.feature_names]])
            
            # Calculate SHAP values
            shap_values = self.explainer.shap_values(X)
            
            # Handle multi-output models
            if isinstance(shap_values, list):
                shap_values = shap_values[0]
            if len(shap_values.shape) > 1:
                shap_values = shap_values[0]
            
            # Pair with feature names
            contributions = list(zip(self.feature_names, shap_values))
            
            # Sort by absolute value
            contributions.sort(key=lambda x: abs(x[1]), reverse=True)
            
            return contributions
            
        except Exception as e:
            logger.error(f"SHAP explanation failed: {e}")
            return []


class DecisionTreeExplainer:
    """
    Decision tree based explanations
    Creates interpretable rules from complex models
    """
    
    def __init__(self, config: ExplainabilityConfig = None):
        self.config = config or ExplainabilityConfig()
        self.tree_model = None
        self.is_fitted = False
        self.feature_names: List[str] = []
    
    def fit_surrogate(
        self,
        X: pd.DataFrame,
        predictions: np.ndarray,
        feature_cols: List[str]
    ) -> bool:
        """
        Fit a decision tree as a surrogate model
        
        Args:
            X: Feature data
            predictions: Predictions from complex model
            feature_cols: Feature column names
        
        Returns:
            True if fitting successful
        """
        try:
            from sklearn.tree import DecisionTreeRegressor
            
            self.feature_names = feature_cols
            
            # Fit surrogate decision tree
            self.tree_model = DecisionTreeRegressor(
                max_depth=self.config.decision_tree_max_depth,
                min_samples_leaf=5,
                random_state=42
            )
            
            self.tree_model.fit(X[feature_cols].values, predictions)
            self.is_fitted = True
            
            return True
            
        except Exception as e:
            logger.error(f"Surrogate tree fitting failed: {e}")
            return False
    
    def get_decision_path(
        self, 
        observation: Dict[str, float]
    ) -> DecisionPath:
        """
        Get the decision path for an observation
        """
        if not self.is_fitted:
            return DecisionPath([], 0.5, 0.0)
        
        try:
            # Prepare input
            X = np.array([[observation.get(f, 0.5) for f in self.feature_names]])
            
            # Get decision path
            node_indicator = self.tree_model.decision_path(X)
            
            # Get feature info from tree
            tree = self.tree_model.tree_
            node_index = node_indicator.indices
            
            decisions = []
            for node_id in node_index:
                if tree.feature[node_id] != -2:  # Not a leaf
                    feature_idx = tree.feature[node_id]
                    threshold = tree.threshold[node_id]
                    feature_name = self.feature_names[feature_idx]
                    
                    feature_val = observation.get(feature_name, 0)
                    
                    if feature_val <= threshold:
                        decisions.append(f"{feature_name} ≤ {threshold:.2f}")
                    else:
                        decisions.append(f"{feature_name} > {threshold:.2f}")
            
            # Get prediction
            prediction = self.tree_model.predict(X)[0]
            
            return DecisionPath(
                node_decisions=decisions,
                final_prediction=prediction,
                path_confidence=0.8
            )
            
        except Exception as e:
            logger.error(f"Decision path extraction failed: {e}")
            return DecisionPath([], 0.5, 0.0)
    
    def get_rules(
        self, 
        observation: Dict[str, float]
    ) -> List[str]:
        """Get simplified rules for the prediction"""
        path = self.get_decision_path(observation)
        
        if not path.node_decisions:
            return []
        
        # Simplify rules
        simplified = []
        for decision in path.node_decisions[:3]:  # Top 3 rules
            # Convert to natural language
            rule = decision.replace("≤", "is at or below").replace(">", "is above")
            simplified.append(rule)
        
        return simplified


class RuleBasedExplainer:
    """
    Rule-based explanations when ML explanations unavailable
    Uses predefined logic based on domain knowledge
    """
    
    def __init__(self):
        # Feature thresholds for rule generation
        self.thresholds = {
            "sleep_hours": {"low": 6.0, "high": 10.0},
            "activity_level": {"low": 0.3, "high": 0.7},
            "emotion_score": {"low": 0.4, "high": 0.7},
            "behaviour_score": {"low": 0.4, "high": 0.7}
        }
        
        # Feature descriptions
        self.feature_descriptions = {
            "sleep_hours": "sleep duration",
            "activity_level": "activity level",
            "emotion_score": "emotional patterns",
            "behaviour_score": "behavioral calmness"
        }
    
    def explain(
        self, 
        observation: Dict[str, float],
        prediction: float,
        prediction_type: str
    ) -> List[Tuple[str, str, str]]:
        """
        Generate rule-based explanations
        
        Returns:
            List of (feature, direction, explanation)
        """
        explanations = []
        
        for feature, value in observation.items():
            if feature not in self.thresholds:
                continue
            
            thresh = self.thresholds[feature]
            desc = self.feature_descriptions.get(feature, feature)
            
            if value < thresh["low"]:
                direction = "decreases"
                explanation = f"Lower {desc} may be contributing to the observed pattern"
            elif value > thresh["high"]:
                direction = "increases"
                explanation = f"Higher {desc} may be influencing the outcome"
            else:
                direction = "neutral"
                explanation = f"{desc.capitalize()} is within typical range"
            
            explanations.append((feature, direction, explanation))
        
        return explanations


class ExplanationEngine:
    """
    Main explanation engine
    Orchestrates SHAP, decision tree, and rule-based explanations
    """
    
    def __init__(self, config: PipelineConfig = None):
        self.config = config or get_config()
        self.explainability_config = self.config.explainability
        self.ethics_config = self.config.ethics
        
        # Explainers
        self.shap_explainer = SHAPExplainer(self.explainability_config)
        self.tree_explainer = DecisionTreeExplainer(self.explainability_config)
        self.rule_explainer = RuleBasedExplainer()
        
        # Feature descriptions for natural language
        self.feature_descriptions = {
            "sleep_hours": "sleep duration",
            "activity_level": "activity level",
            "emotion_score": "emotional patterns",
            "behaviour_score": "behavioral calmness",
            "medication_flag": "medication schedule"
        }
    
    def initialize_shap(
        self,
        model: Any,
        background_data: pd.DataFrame,
        feature_cols: List[str]
    ) -> bool:
        """Initialize SHAP explainer with a trained model"""
        return self.shap_explainer.initialize(model, background_data, feature_cols)
    
    def initialize_decision_tree(
        self,
        X: pd.DataFrame,
        predictions: np.ndarray,
        feature_cols: List[str]
    ) -> bool:
        """Initialize decision tree surrogate"""
        return self.tree_explainer.fit_surrogate(X, predictions, feature_cols)
    
    def generate_explanation(
        self,
        child_id: str,
        observation: Dict[str, float],
        prediction_type: str,
        prediction_value: float,
        model_confidence: float = 0.8
    ) -> ExplanationOutput:
        """
        Generate comprehensive explanation for a prediction
        
        Args:
            child_id: Child identifier
            observation: Feature values
            prediction_type: Type of prediction (anomaly, forecast, correlation)
            prediction_value: The prediction value
            model_confidence: Model confidence in prediction
        
        Returns:
            ExplanationOutput with human-readable explanations
        """
        feature_contributions = []
        explanation_method = "rule_based"
        
        # Try SHAP first
        if self.explainability_config.enable_shap and self.shap_explainer.is_initialized:
            shap_values = self.shap_explainer.explain(observation)
            if shap_values:
                explanation_method = "shap"
                feature_contributions = self._process_shap_values(
                    shap_values, observation
                )
        
        # Try decision tree
        if not feature_contributions and self.explainability_config.enable_decision_tree:
            if self.tree_explainer.is_fitted:
                rules = self.tree_explainer.get_rules(observation)
                if rules:
                    explanation_method = "decision_tree"
                    feature_contributions = self._process_tree_rules(
                        rules, observation
                    )
        
        # Fallback to rule-based
        if not feature_contributions:
            rule_explanations = self.rule_explainer.explain(
                observation, prediction_value, prediction_type
            )
            feature_contributions = self._process_rule_explanations(
                rule_explanations, observation
            )
        
        # Generate primary explanation
        primary = self._generate_primary_explanation(
            feature_contributions, prediction_type, prediction_value
        )
        
        # Generate secondary explanations
        secondary = self._generate_secondary_explanations(
            feature_contributions, prediction_type
        )
        
        # Generate caveats
        caveats = self._generate_caveats(model_confidence, explanation_method)
        
        # Get disclaimer
        disclaimer = self._get_ethical_disclaimer()
        
        return ExplanationOutput(
            child_id=child_id,
            prediction_type=prediction_type,
            prediction_value=round(prediction_value, 3),
            feature_contributions=feature_contributions,
            primary_explanation=primary,
            secondary_explanations=secondary,
            confidence=round(model_confidence, 2),
            caveats=caveats,
            disclaimer=disclaimer,
            explanation_method=explanation_method,
            created_at=datetime.now().isoformat()
        )
    
    def _process_shap_values(
        self,
        shap_values: List[Tuple[str, float]],
        observation: Dict[str, float]
    ) -> List[FeatureContribution]:
        """Process SHAP values into FeatureContribution objects"""
        contributions = []
        
        total_abs = sum(abs(sv) for _, sv in shap_values)
        if total_abs == 0:
            total_abs = 1
        
        for feature, shap_value in shap_values[:5]:  # Top 5
            feature_value = observation.get(feature, 0)
            
            # Direction
            if shap_value > 0.01:
                direction = "increases"
            elif shap_value < -0.01:
                direction = "decreases"
            else:
                direction = "neutral"
            
            # Magnitude
            rel_importance = abs(shap_value) / total_abs
            if rel_importance > 0.4:
                magnitude = "strongly"
            elif rel_importance > 0.15:
                magnitude = "moderately"
            else:
                magnitude = "slightly"
            
            # Natural language
            desc = self.feature_descriptions.get(feature, feature)
            nl = self._create_natural_language(desc, direction, magnitude, feature_value)
            
            contributions.append(FeatureContribution(
                feature_name=feature,
                feature_value=round(feature_value, 3),
                shap_value=round(shap_value, 4),
                contribution_direction=direction,
                contribution_magnitude=magnitude,
                natural_language=nl
            ))
        
        return contributions
    
    def _process_tree_rules(
        self,
        rules: List[str],
        observation: Dict[str, float]
    ) -> List[FeatureContribution]:
        """Process decision tree rules into contributions"""
        contributions = []
        
        for rule in rules:
            # Parse rule to extract feature
            for feature in self.feature_descriptions:
                if feature in rule:
                    feature_value = observation.get(feature, 0)
                    
                    contributions.append(FeatureContribution(
                        feature_name=feature,
                        feature_value=round(feature_value, 3),
                        shap_value=0.0,
                        contribution_direction="relevant",
                        contribution_magnitude="moderately",
                        natural_language=f"Analysis considers that {rule}"
                    ))
                    break
        
        return contributions
    
    def _process_rule_explanations(
        self,
        rule_explanations: List[Tuple[str, str, str]],
        observation: Dict[str, float]
    ) -> List[FeatureContribution]:
        """Process rule-based explanations into contributions"""
        contributions = []
        
        for feature, direction, explanation in rule_explanations:
            if direction == "neutral":
                continue
            
            feature_value = observation.get(feature, 0)
            
            contributions.append(FeatureContribution(
                feature_name=feature,
                feature_value=round(feature_value, 3),
                shap_value=0.0,
                contribution_direction=direction,
                contribution_magnitude="moderately",
                natural_language=explanation
            ))
        
        return contributions
    
    def _create_natural_language(
        self,
        feature_desc: str,
        direction: str,
        magnitude: str,
        value: float
    ) -> str:
        """Create natural language explanation for a feature"""
        
        if direction == "neutral":
            return f"{feature_desc.capitalize()} is within expected patterns."
        
        verb = "tends to increase" if direction == "increases" else "tends to decrease"
        
        return f"{feature_desc.capitalize()} {magnitude} {verb} the likelihood of this observation."
    
    def _generate_primary_explanation(
        self,
        contributions: List[FeatureContribution],
        prediction_type: str,
        prediction_value: float
    ) -> str:
        """Generate the main explanation"""
        
        if not contributions:
            return "Analysis based on overall pattern comparison."
        
        # Get top contributor
        top = contributions[0]
        
        type_descriptions = {
            "anomaly": "pattern deviation",
            "forecast": "predicted trend",
            "correlation": "behavioral relationship"
        }
        
        type_desc = type_descriptions.get(prediction_type, "observation")
        
        explanation = (
            f"This {type_desc} is primarily influenced by {top.natural_language.lower()}"
        )
        
        if len(contributions) > 1:
            second = contributions[1]
            explanation += f" Additionally, {second.feature_name.replace('_', ' ')} also contributes to this pattern."
        
        return explanation
    
    def _generate_secondary_explanations(
        self,
        contributions: List[FeatureContribution],
        prediction_type: str
    ) -> List[str]:
        """Generate additional context explanations"""
        
        explanations = []
        
        for contrib in contributions[1:3]:  # 2nd and 3rd contributors
            explanations.append(contrib.natural_language)
        
        return explanations
    
    def _generate_caveats(
        self,
        confidence: float,
        method: str
    ) -> List[str]:
        """Generate appropriate caveats for the explanation"""
        
        caveats = []
        
        if confidence < 0.6:
            caveats.append(
                "Analysis confidence is limited due to data variability. "
                "Interpret with caution."
            )
        
        if method == "rule_based":
            caveats.append(
                "Explanation based on general patterns rather than "
                "personalized model analysis."
            )
        
        caveats.append(
            "Individual factors may vary. This analysis is intended "
            "as an observation aid, not a definitive assessment."
        )
        
        return caveats
    
    def _get_ethical_disclaimer(self) -> str:
        """Get the ethics disclaimer"""
        return self.ethics_config.academic_disclaimer
    
    def summarize_for_parents(
        self,
        explanation: ExplanationOutput
    ) -> str:
        """
        Create a simplified summary for parents
        Uses non-technical, supportive language
        """
        summary_parts = []
        
        # Opening
        summary_parts.append(
            "Based on today's observations, here's what we noticed:"
        )
        
        # Main finding
        if explanation.feature_contributions:
            top = explanation.feature_contributions[0]
            feature_simple = top.feature_name.replace("_", " ")
            
            if top.contribution_direction == "increases":
                summary_parts.append(
                    f"• {feature_simple.capitalize()} appears to be a positive factor today."
                )
            elif top.contribution_direction == "decreases":
                summary_parts.append(
                    f"• {feature_simple.capitalize()} may need some attention."
                )
            else:
                summary_parts.append(
                    f"• {feature_simple.capitalize()} is within typical patterns."
                )
        
        # Confidence
        if explanation.confidence >= 0.7:
            summary_parts.append(
                f"\nOur confidence in this observation is good ({int(explanation.confidence*100)}%)."
            )
        else:
            summary_parts.append(
                "\nThis observation has some uncertainty - patterns may vary."
            )
        
        # Supportive close
        summary_parts.append(
            "\nRemember: Every day is different, and you're doing great!"
        )
        
        return "\n".join(summary_parts)
    
    def summarize_for_therapists(
        self,
        explanation: ExplanationOutput
    ) -> str:
        """
        Create a detailed summary for therapists
        Includes technical details and actionable insights
        """
        summary_parts = []
        
        # Header
        summary_parts.append(
            f"**Analysis Type:** {explanation.prediction_type.title()}"
        )
        summary_parts.append(
            f"**Method:** {explanation.explanation_method.replace('_', ' ').title()}"
        )
        summary_parts.append(
            f"**Confidence:** {explanation.confidence:.0%}"
        )
        
        # Primary explanation
        summary_parts.append(f"\n**Summary:** {explanation.primary_explanation}")
        
        # Feature breakdown
        if explanation.feature_contributions:
            summary_parts.append("\n**Feature Analysis:**")
            for contrib in explanation.feature_contributions:
                summary_parts.append(
                    f"  • {contrib.feature_name}: {contrib.feature_value:.3f} "
                    f"({contrib.contribution_direction})"
                )
        
        # Caveats
        if explanation.caveats:
            summary_parts.append("\n**Notes:**")
            for caveat in explanation.caveats[:2]:
                summary_parts.append(f"  • {caveat}")
        
        return "\n".join(summary_parts)


class EthicsEnforcer:
    """
    Enforces ethical guidelines in all outputs
    Ensures non-diagnostic, probability-based language
    """
    
    def __init__(self, config: EthicsConfig = None):
        self.config = config or EthicsConfig()
    
    def validate_output(self, text: str) -> Tuple[bool, List[str]]:
        """
        Validate that output text follows ethical guidelines
        
        Returns:
            (is_valid, list of violations)
        """
        violations = []
        text_lower = text.lower()
        
        # Check for prohibited terms
        for term in self.config.prohibited_terms:
            if term.lower() in text_lower:
                violations.append(f"Prohibited term found: '{term}'")
        
        return len(violations) == 0, violations
    
    def sanitize_output(self, text: str) -> str:
        """
        Remove or replace prohibited terms in output
        """
        result = text
        
        # Replacements for common problematic patterns
        replacements = {
            "diagnose": "observe",
            "diagnosis": "observation",
            "disorder": "patterns",
            "abnormal": "atypical",
            "symptoms": "indicators",
            "treatment": "support strategies",
            "patient": "child"
        }
        
        for old, new in replacements.items():
            result = result.replace(old, new)
            result = result.replace(old.title(), new.title())
        
        return result
    
    def add_probability_language(self, text: str) -> str:
        """
        Ensure text uses probability-based language
        """
        # Add qualifiers to definitive statements
        definitive_to_probabilistic = {
            " is ": " may be ",
            " will ": " might ",
            " causes ": " may contribute to ",
            " shows ": " appears to show ",
            " indicates ": " may indicate ",
            " confirms ": " suggests "
        }
        
        result = text
        for old, new in definitive_to_probabilistic.items():
            # Only replace if not already probabilistic
            if old in result and "may" not in result[:result.find(old)]:
                result = result.replace(old, new, 1)
        
        return result


# Example usage
if __name__ == "__main__":
    # Create explanation engine
    engine = ExplanationEngine()
    
    # Sample observation
    observation = {
        "sleep_hours": 6.5,
        "activity_level": 0.7,
        "emotion_score": 0.45,
        "behaviour_score": 0.4
    }
    
    # Generate explanation
    explanation = engine.generate_explanation(
        child_id="child_1",
        observation=observation,
        prediction_type="anomaly",
        prediction_value=0.72,
        model_confidence=0.85
    )
    
    print("Explanation Output:")
    print(f"  Prediction Type: {explanation.prediction_type}")
    print(f"  Prediction Value: {explanation.prediction_value}")
    print(f"  Method: {explanation.explanation_method}")
    print(f"  Confidence: {explanation.confidence:.0%}")
    
    print(f"\nPrimary Explanation:")
    print(f"  {explanation.primary_explanation}")
    
    print(f"\nFeature Contributions:")
    for fc in explanation.feature_contributions:
        print(f"  {fc.feature_name}: {fc.natural_language}")
    
    print(f"\nCaveats:")
    for caveat in explanation.caveats:
        print(f"  • {caveat}")
    
    print(f"\n--- Parent Summary ---")
    print(engine.summarize_for_parents(explanation))
    
    print(f"\n--- Therapist Summary ---")
    print(engine.summarize_for_therapists(explanation))
    
    # Test ethics enforcer
    enforcer = EthicsEnforcer()
    test_text = "The patient shows symptoms of a disorder."
    sanitized = enforcer.sanitize_output(test_text)
    print(f"\nEthics Sanitization:")
    print(f"  Original: {test_text}")
    print(f"  Sanitized: {sanitized}")
