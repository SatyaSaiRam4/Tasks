package com.myapp

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews

/**
 * Memo on the home screen: the streak, today's tasks and the next reminder.
 * The app writes those (MemoWidgetModule) whenever its data changes; this
 * draws them from the saved copy, so the widget works with the app closed.
 * Tapping it opens Memo.
 */
class MemoWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    for (id in ids) manager.updateAppWidget(id, views(context))
  }

  companion object {
    const val PREFS = "memo_widget"

    fun views(context: Context): RemoteViews {
      val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      val views = RemoteViews(context.packageName, R.layout.memo_widget)
      val signedIn = prefs.getBoolean("signedIn", false)
      if (signedIn) {
        views.setTextViewText(R.id.widget_streak, "🔥 ${prefs.getInt("streak", 0)}")
        views.setTextViewText(R.id.widget_today, prefs.getString("today", "") ?: "")
        views.setTextViewText(R.id.widget_next, prefs.getString("next", "") ?: "")
      } else {
        views.setTextViewText(R.id.widget_streak, "🔥 Memo")
        views.setTextViewText(R.id.widget_today, "Sign in to see your day")
        views.setTextViewText(R.id.widget_next, "")
      }
      val open = Intent(context, MainActivity::class.java).apply { flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP }
      val tap = PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
      views.setOnClickPendingIntent(R.id.widget_root, tap)
      return views
    }

    /** Redraws every Memo widget on the home screen. */
    fun refreshAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, MemoWidgetProvider::class.java))
      for (id in ids) manager.updateAppWidget(id, views(context))
    }
  }
}
