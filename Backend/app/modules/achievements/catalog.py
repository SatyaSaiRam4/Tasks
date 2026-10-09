from dataclasses import dataclass


@dataclass(frozen=True)
class AchievementDef:
    code: str
    title: str
    description: str
    icon: str


CATALOG: tuple[AchievementDef, ...] = (
    AchievementDef("FIRST_STEP", "First Step", "Complete your first full day.", "sparkles"),
    AchievementDef("STREAK_3", "Warming Up", "Reach 3 streak points.", "flame"),
    AchievementDef("STREAK_7", "Streak Warrior", "Reach 7 streak points.", "flame"),
    AchievementDef("STREAK_14", "Two Weeks Strong", "Reach 14 streak points.", "flame"),
    AchievementDef("STREAK_30", "Thirty Strong", "Reach 30 streak points.", "trophy"),
    AchievementDef("STREAK_100", "Centurion", "Reach 100 streak points.", "crown"),
    AchievementDef("ACTIONS_100", "Hundred Tasks", "Complete 100 tasks.", "check-circle"),
    AchievementDef("EARLY_STARTER", "Early Starter", "Complete 10 tasks before 9 AM.", "sunrise"),
    AchievementDef("COMEBACK", "Comeback", "Have a full day again after losing a streak.", "refresh"),
    AchievementDef("TRACK_FINISHER", "Plan Finisher", "Finish a plan with at least 80% of its tasks done.", "flag"),
    AchievementDef("PERFECT_TRACK", "Perfect Plan", "Finish a whole plan without missing a day.", "award"),
)

BY_CODE = {a.code: a for a in CATALOG}
STREAK_MILESTONES = {"STREAK_3": 3, "STREAK_7": 7, "STREAK_14": 14, "STREAK_30": 30, "STREAK_100": 100}
