from dataclasses import dataclass


@dataclass(frozen=True)
class AchievementDef:
    code: str
    title: str
    description: str
    icon: str


CATALOG: tuple[AchievementDef, ...] = (
    AchievementDef("FIRST_STEP", "First Step", "Complete your first full day.", "sparkles"),
    AchievementDef("STREAK_3", "Warming Up", "Reach a 3-day streak.", "flame"),
    AchievementDef("STREAK_7", "7 Day Warrior", "Maintain a 7-day streak.", "flame"),
    AchievementDef("STREAK_14", "Two Weeks Strong", "Maintain a 14-day streak.", "flame"),
    AchievementDef("STREAK_30", "30 Day Consistency", "Maintain a 30-day streak.", "trophy"),
    AchievementDef("STREAK_100", "Centurion", "Maintain a 100-day streak.", "crown"),
    AchievementDef("ACTIONS_100", "Hundred Tasks", "Complete 100 tasks.", "check-circle"),
    AchievementDef("EARLY_STARTER", "Early Starter", "Complete 10 tasks before 9 AM.", "sunrise"),
    AchievementDef("COMEBACK", "Comeback", "Have a full day again after losing a streak.", "refresh"),
    AchievementDef("TRACK_FINISHER", "Category Finisher", "Finish a category with at least 80% of its tasks done.", "flag"),
    AchievementDef("PERFECT_TRACK", "Perfect Category", "Finish a whole category without missing a day.", "award"),
)

BY_CODE = {a.code: a for a in CATALOG}
STREAK_MILESTONES = {"STREAK_3": 3, "STREAK_7": 7, "STREAK_14": 14, "STREAK_30": 30, "STREAK_100": 100}
