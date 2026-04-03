"""
AutismCare Personalized Behavioural Baseline Engine
Creates individual child baselines using unsupervised learning
"""

import numpy as np
import pandas as pd
from typing import Dict, Optional, List, Tuple
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
import logging

from config import PipelineConfig, BaselineConfig, ClusteringMethod, get_config

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class ChildBaseline:
    """Personalized baseline for a child"""
    child_id: str
    baseline_sleep: float
    baseline_sleep_std: float
    baseline_activity: float
    baseline_activity_std: float
    baseline_emotion: float
    baseline_emotion_std: float
    baseline_behaviour: float
    baseline_behaviour_std: float
    
    # Clustering metadata
    cluster_label: Optional[int] = None
    cluster_profile: Optional[str] = None  # e.g., "high_activity_stable"
    
    # Statistical metadata
    data_points_used: int = 0
    date_range_start: Optional[str] = None
    date_range_end: Optional[str] = None
    
    # Confidence and validity
    confidence: float = 0.0
    is_valid: bool = False
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for storage"""
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: Dict) -> "ChildBaseline":
        """Create from dictionary"""
        return cls(**data)


@dataclass
class ClusterProfile:
    """Profile description for a behavior cluster"""
    cluster_id: int
    name: str
    description: str
    typical_sleep: float
    typical_activity: float
    typical_emotion: float
    typical_behaviour: float
    member_count: int


class StatisticalProfiler:
    """
    Create baselines using rolling statistical profiling
    Uses mean and standard deviation over a rolling window
    """
    
    def __init__(self, config: BaselineConfig = None):
        self.config = config or BaselineConfig()
        self.rolling_window = self.config.rolling_window_days
        self.min_data_points = self.config.min_data_points
        self.std_threshold = self.config.std_threshold
    
    def create_baseline(
        self, 
        child_data: pd.DataFrame,
        child_id: str
    ) -> ChildBaseline:
        """
        Create a statistical baseline for a single child
        
        Args:
            child_data: DataFrame with columns [sleep_hours, activity_level, 
                       emotion_score, behaviour_score]
            child_id: Child identifier
        
        Returns:
            ChildBaseline with mean and std for each feature
        """
        # Validate minimum data
        if len(child_data) < self.min_data_points:
            logger.warning(
                f"Insufficient data for child {child_id}: "
                f"{len(child_data)} < {self.min_data_points}"
            )
            return self._create_invalid_baseline(child_id)
        
        # Calculate statistics
        stats = {}
        for col in ["sleep_hours", "activity_level", "emotion_score", "behaviour_score"]:
            if col in child_data.columns:
                stats[col] = {
                    "mean": child_data[col].mean(),
                    "std": child_data[col].std()
                }
            else:
                stats[col] = {"mean": 0.5, "std": 0.1}
        
        # Calculate confidence based on data quantity and consistency
        data_confidence = min(1.0, len(child_data) / 30)  # More data = higher confidence
        consistency_scores = [
            1 - min(1, stats[col]["std"]) for col in stats
        ]
        consistency_confidence = np.mean(consistency_scores)
        overall_confidence = (data_confidence * 0.6 + consistency_confidence * 0.4)
        
        # Get date range
        if "date" in child_data.columns:
            dates = pd.to_datetime(child_data["date"])
            date_start = dates.min().strftime("%Y-%m-%d")
            date_end = dates.max().strftime("%Y-%m-%d")
        else:
            date_start = date_end = None
        
        return ChildBaseline(
            child_id=child_id,
            baseline_sleep=round(stats["sleep_hours"]["mean"], 2),
            baseline_sleep_std=round(stats["sleep_hours"]["std"], 2),
            baseline_activity=round(stats["activity_level"]["mean"], 3),
            baseline_activity_std=round(stats["activity_level"]["std"], 3),
            baseline_emotion=round(stats["emotion_score"]["mean"], 3),
            baseline_emotion_std=round(stats["emotion_score"]["std"], 3),
            baseline_behaviour=round(stats["behaviour_score"]["mean"], 3),
            baseline_behaviour_std=round(stats["behaviour_score"]["std"], 3),
            data_points_used=len(child_data),
            date_range_start=date_start,
            date_range_end=date_end,
            confidence=round(overall_confidence, 2),
            is_valid=True,
            created_at=datetime.now().isoformat(),
            updated_at=datetime.now().isoformat()
        )
    
    def _create_invalid_baseline(self, child_id: str) -> ChildBaseline:
        """Create an invalid baseline placeholder"""
        return ChildBaseline(
            child_id=child_id,
            baseline_sleep=8.0,
            baseline_sleep_std=1.0,
            baseline_activity=0.5,
            baseline_activity_std=0.2,
            baseline_emotion=0.5,
            baseline_emotion_std=0.2,
            baseline_behaviour=0.5,
            baseline_behaviour_std=0.2,
            data_points_used=0,
            confidence=0.0,
            is_valid=False,
            created_at=datetime.now().isoformat()
        )
    
    def update_rolling_baseline(
        self,
        existing_baseline: ChildBaseline,
        new_data: pd.DataFrame
    ) -> ChildBaseline:
        """
        Update baseline with new data using exponential moving average
        
        Args:
            existing_baseline: Current baseline
            new_data: New observations (recent)
        
        Returns:
            Updated baseline
        """
        if new_data.empty:
            return existing_baseline
        
        # Use exponential smoothing for updates
        alpha = 2 / (self.rolling_window + 1)  # Smoothing factor
        
        for row_idx in range(len(new_data)):
            row = new_data.iloc[row_idx]
            
            # Update each feature
            if "sleep_hours" in row:
                existing_baseline.baseline_sleep = (
                    alpha * row["sleep_hours"] + 
                    (1 - alpha) * existing_baseline.baseline_sleep
                )
            
            if "activity_level" in row:
                existing_baseline.baseline_activity = (
                    alpha * row["activity_level"] + 
                    (1 - alpha) * existing_baseline.baseline_activity
                )
            
            if "emotion_score" in row:
                existing_baseline.baseline_emotion = (
                    alpha * row["emotion_score"] + 
                    (1 - alpha) * existing_baseline.baseline_emotion
                )
            
            if "behaviour_score" in row:
                existing_baseline.baseline_behaviour = (
                    alpha * row["behaviour_score"] + 
                    (1 - alpha) * existing_baseline.baseline_behaviour
                )
        
        existing_baseline.data_points_used += len(new_data)
        existing_baseline.updated_at = datetime.now().isoformat()
        
        return existing_baseline


class KMeansProfiler:
    """
    Create baselines using K-Means clustering
    Groups children into behavioral clusters for population-level insights
    """
    
    def __init__(self, config: BaselineConfig = None):
        self.config = config or BaselineConfig()
        self.n_clusters = self.config.n_clusters
        self.max_iterations = self.config.max_iterations
        self.scaler = StandardScaler()
        self.kmeans = None
        self.cluster_profiles: Dict[int, ClusterProfile] = {}
    
    def fit_clusters(self, all_children_data: pd.DataFrame) -> Dict[int, ClusterProfile]:
        """
        Fit K-Means on aggregated data from all children
        
        Args:
            all_children_data: Combined data with child_id column
        
        Returns:
            Dictionary of cluster profiles
        """
        # Aggregate to per-child means
        child_means = all_children_data.groupby("child_id").agg({
            "sleep_hours": "mean",
            "activity_level": "mean",
            "emotion_score": "mean",
            "behaviour_score": "mean"
        }).reset_index()
        
        if len(child_means) < self.n_clusters:
            logger.warning(f"Not enough children for {self.n_clusters} clusters")
            self.n_clusters = max(2, len(child_means))
        
        # Prepare features
        feature_cols = ["sleep_hours", "activity_level", "emotion_score", "behaviour_score"]
        X = child_means[feature_cols].values
        
        # Scale features
        X_scaled = self.scaler.fit_transform(X)
        
        # Fit K-Means
        self.kmeans = KMeans(
            n_clusters=self.n_clusters,
            max_iter=self.max_iterations,
            random_state=42,
            n_init=10
        )
        child_means["cluster"] = self.kmeans.fit_predict(X_scaled)
        
        # Create cluster profiles
        self.cluster_profiles = {}
        cluster_names = self._generate_cluster_names(child_means, feature_cols)
        
        for cluster_id in range(self.n_clusters):
            cluster_data = child_means[child_means["cluster"] == cluster_id]
            
            profile = ClusterProfile(
                cluster_id=cluster_id,
                name=cluster_names.get(cluster_id, f"Profile {cluster_id + 1}"),
                description=self._describe_cluster(cluster_data, feature_cols),
                typical_sleep=round(cluster_data["sleep_hours"].mean(), 2),
                typical_activity=round(cluster_data["activity_level"].mean(), 3),
                typical_emotion=round(cluster_data["emotion_score"].mean(), 3),
                typical_behaviour=round(cluster_data["behaviour_score"].mean(), 3),
                member_count=len(cluster_data)
            )
            self.cluster_profiles[cluster_id] = profile
        
        return self.cluster_profiles
    
    def _generate_cluster_names(
        self, 
        data: pd.DataFrame, 
        feature_cols: List[str]
    ) -> Dict[int, str]:
        """Generate descriptive names for clusters"""
        names = {}
        
        for cluster_id in data["cluster"].unique():
            cluster_data = data[data["cluster"] == cluster_id]
            
            # Determine dominant characteristics
            characteristics = []
            
            avg_sleep = cluster_data["sleep_hours"].mean()
            if avg_sleep > 9:
                characteristics.append("high_sleep")
            elif avg_sleep < 7:
                characteristics.append("low_sleep")
            
            avg_activity = cluster_data["activity_level"].mean()
            if avg_activity > 0.6:
                characteristics.append("high_activity")
            elif avg_activity < 0.4:
                characteristics.append("low_activity")
            
            avg_emotion = cluster_data["emotion_score"].mean()
            if avg_emotion > 0.6:
                characteristics.append("positive_emotion")
            elif avg_emotion < 0.4:
                characteristics.append("variable_emotion")
            
            avg_behaviour = cluster_data["behaviour_score"].mean()
            if avg_behaviour > 0.6:
                characteristics.append("calm_behaviour")
            elif avg_behaviour < 0.4:
                characteristics.append("variable_behaviour")
            
            if characteristics:
                names[cluster_id] = "_".join(characteristics[:2])
            else:
                names[cluster_id] = f"balanced_profile_{cluster_id}"
        
        return names
    
    def _describe_cluster(
        self, 
        cluster_data: pd.DataFrame, 
        feature_cols: List[str]
    ) -> str:
        """Generate natural language description of cluster"""
        descriptions = []
        
        avg_sleep = cluster_data["sleep_hours"].mean()
        if avg_sleep > 9:
            descriptions.append("typically gets more sleep")
        elif avg_sleep < 7:
            descriptions.append("typically gets less sleep")
        else:
            descriptions.append("has regular sleep patterns")
        
        avg_activity = cluster_data["activity_level"].mean()
        if avg_activity > 0.6:
            descriptions.append("shows high activity levels")
        elif avg_activity < 0.4:
            descriptions.append("shows lower activity levels")
        else:
            descriptions.append("maintains moderate activity")
        
        avg_emotion = cluster_data["emotion_score"].mean()
        if avg_emotion > 0.6:
            descriptions.append("often exhibits positive emotions")
        elif avg_emotion < 0.4:
            descriptions.append("may experience varied emotional states")
        else:
            descriptions.append("shows balanced emotional patterns")
        
        return "Children in this group " + ", ".join(descriptions) + "."
    
    def predict_cluster(self, child_data: pd.DataFrame) -> Tuple[int, str]:
        """
        Predict which cluster a child belongs to
        
        Returns:
            (cluster_id, cluster_name)
        """
        if self.kmeans is None:
            raise ValueError("Model not fitted. Call fit_clusters first.")
        
        # Calculate child's mean features
        means = child_data[["sleep_hours", "activity_level", 
                           "emotion_score", "behaviour_score"]].mean().values
        
        # Scale and predict
        means_scaled = self.scaler.transform([means])
        cluster_id = self.kmeans.predict(means_scaled)[0]
        
        profile = self.cluster_profiles.get(cluster_id)
        cluster_name = profile.name if profile else f"cluster_{cluster_id}"
        
        return cluster_id, cluster_name
    
    def create_cluster_enhanced_baseline(
        self,
        child_data: pd.DataFrame,
        child_id: str
    ) -> ChildBaseline:
        """
        Create baseline enhanced with cluster information
        """
        # First create statistical baseline
        stat_profiler = StatisticalProfiler(self.config)
        baseline = stat_profiler.create_baseline(child_data, child_id)
        
        # Add cluster info if model is fitted
        if self.kmeans is not None and baseline.is_valid:
            try:
                cluster_id, cluster_name = self.predict_cluster(child_data)
                baseline.cluster_label = cluster_id
                baseline.cluster_profile = cluster_name
            except Exception as e:
                logger.warning(f"Could not assign cluster: {e}")
        
        return baseline


class BaselineEngine:
    """
    Main baseline creation engine
    Orchestrates statistical and clustering methods
    """
    
    def __init__(self, config: PipelineConfig = None):
        self.config = config or get_config()
        self.baseline_config = self.config.baseline
        
        self.statistical_profiler = StatisticalProfiler(self.baseline_config)
        self.kmeans_profiler = KMeansProfiler(self.baseline_config)
        
        # Storage for baselines
        self.baselines: Dict[str, ChildBaseline] = {}
    
    def create_baseline(
        self,
        child_data: pd.DataFrame,
        child_id: str,
        method: ClusteringMethod = None
    ) -> ChildBaseline:
        """
        Create a personalized baseline for a child
        
        Args:
            child_data: DataFrame with child's historical data
            child_id: Child identifier
            method: Clustering method to use (overrides config)
        
        Returns:
            ChildBaseline
        """
        method = method or self.baseline_config.method
        
        if method == ClusteringMethod.STATISTICAL:
            baseline = self.statistical_profiler.create_baseline(child_data, child_id)
        else:  # K-Means
            baseline = self.kmeans_profiler.create_cluster_enhanced_baseline(
                child_data, child_id
            )
        
        # Store baseline
        self.baselines[child_id] = baseline
        
        return baseline
    
    def create_baselines_batch(
        self,
        all_data: pd.DataFrame
    ) -> Dict[str, ChildBaseline]:
        """
        Create baselines for multiple children
        Also fits the K-Means model if using cluster method
        """
        if "child_id" not in all_data.columns:
            raise ValueError("Data must contain 'child_id' column")
        
        # Fit K-Means on all data first (for cluster-based method)
        if self.baseline_config.method == ClusteringMethod.KMEANS:
            self.kmeans_profiler.fit_clusters(all_data)
        
        # Create baseline for each child
        baselines = {}
        for child_id in all_data["child_id"].unique():
            child_data = all_data[all_data["child_id"] == child_id]
            baseline = self.create_baseline(child_data, child_id)
            baselines[child_id] = baseline
        
        self.baselines = baselines
        return baselines
    
    def update_baseline(
        self,
        child_id: str,
        new_data: pd.DataFrame
    ) -> Optional[ChildBaseline]:
        """
        Update an existing baseline with new data
        """
        if child_id not in self.baselines:
            logger.warning(f"No existing baseline for child {child_id}")
            return None
        
        existing = self.baselines[child_id]
        updated = self.statistical_profiler.update_rolling_baseline(existing, new_data)
        self.baselines[child_id] = updated
        
        return updated
    
    def get_baseline(self, child_id: str) -> Optional[ChildBaseline]:
        """Get baseline for a child"""
        return self.baselines.get(child_id)
    
    def get_all_baselines(self) -> Dict[str, ChildBaseline]:
        """Get all baselines"""
        return self.baselines
    
    def get_cluster_profiles(self) -> Dict[int, ClusterProfile]:
        """Get cluster profiles (if K-Means was used)"""
        return self.kmeans_profiler.cluster_profiles
    
    def compare_to_baseline(
        self,
        child_id: str,
        current_vector: Dict[str, float]
    ) -> Dict[str, float]:
        """
        Compare current observation to baseline
        
        Returns:
            Dictionary with z-scores for each feature
        """
        baseline = self.get_baseline(child_id)
        if not baseline or not baseline.is_valid:
            return {}
        
        z_scores = {}
        
        if "sleep_hours" in current_vector:
            if baseline.baseline_sleep_std > 0:
                z_scores["sleep_z"] = (
                    current_vector["sleep_hours"] - baseline.baseline_sleep
                ) / baseline.baseline_sleep_std
            else:
                z_scores["sleep_z"] = 0.0
        
        if "activity_level" in current_vector:
            if baseline.baseline_activity_std > 0:
                z_scores["activity_z"] = (
                    current_vector["activity_level"] - baseline.baseline_activity
                ) / baseline.baseline_activity_std
            else:
                z_scores["activity_z"] = 0.0
        
        if "emotion_score" in current_vector:
            if baseline.baseline_emotion_std > 0:
                z_scores["emotion_z"] = (
                    current_vector["emotion_score"] - baseline.baseline_emotion
                ) / baseline.baseline_emotion_std
            else:
                z_scores["emotion_z"] = 0.0
        
        if "behaviour_score" in current_vector:
            if baseline.baseline_behaviour_std > 0:
                z_scores["behaviour_z"] = (
                    current_vector["behaviour_score"] - baseline.baseline_behaviour
                ) / baseline.baseline_behaviour_std
            else:
                z_scores["behaviour_z"] = 0.0
        
        return z_scores


# Example usage
if __name__ == "__main__":
    # Create sample data
    np.random.seed(42)
    
    data = []
    for child_id in ["child_1", "child_2", "child_3"]:
        for day in range(30):
            data.append({
                "child_id": child_id,
                "date": (datetime.now() - timedelta(days=30-day)).strftime("%Y-%m-%d"),
                "sleep_hours": np.random.normal(8, 1),
                "activity_level": np.random.uniform(0.3, 0.7),
                "emotion_score": np.random.uniform(0.4, 0.8),
                "behaviour_score": np.random.uniform(0.4, 0.8),
                "medication_flag": np.random.randint(0, 2)
            })
    
    df = pd.DataFrame(data)
    
    # Create baselines
    engine = BaselineEngine()
    baselines = engine.create_baselines_batch(df)
    
    print("Created Baselines:")
    for child_id, baseline in baselines.items():
        print(f"\n{child_id}:")
        print(f"  Sleep: {baseline.baseline_sleep:.2f} ± {baseline.baseline_sleep_std:.2f}")
        print(f"  Activity: {baseline.baseline_activity:.3f} ± {baseline.baseline_activity_std:.3f}")
        print(f"  Emotion: {baseline.baseline_emotion:.3f} ± {baseline.baseline_emotion_std:.3f}")
        print(f"  Behaviour: {baseline.baseline_behaviour:.3f} ± {baseline.baseline_behaviour_std:.3f}")
        print(f"  Confidence: {baseline.confidence:.0%}")
        print(f"  Data Points: {baseline.data_points_used}")
