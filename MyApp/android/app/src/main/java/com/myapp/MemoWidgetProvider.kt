package com.myapp

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.view.View
import android.widget.RemoteViews

/**
 * Memo on the home screen. Three widgets to pick from (long press on the home
 * screen → Widgets → Memo):
 *  - "Memo" (4×2, this class): the weather, the M logo and streak, today's
 *    tasks, the next reminder, with Melo animated.
 *  - "Memo · Melo" (2×2, MemoSmallWidgetProvider): the weather, Melo, and the
 *    streak.
 *  - "Memo · Today" (4×1, MemoWideWidgetProvider): one slim row with the
 *    streak, today's tasks, the next reminder and the weather.
 * The app writes the data (MemoWidgetModule) whenever it changes; these draw
 * from the saved copy, so the widgets work with the app closed. Tapping one
 * opens Memo.
 */
open class MemoWidgetProvider : AppWidgetProvider() {
  open val layout: Int = R.layout.memo_widget

  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    for (id in ids) manager.updateAppWidget(id, views(context, layout))
  }

  companion object {
    const val PREFS = "memo_widget"

    /** Every Memo widget, with its layout. */
    private val ALL = listOf(
      MemoWidgetProvider::class.java to R.layout.memo_widget,
      MemoSmallWidgetProvider::class.java to R.layout.memo_widget_small,
      MemoWideWidgetProvider::class.java to R.layout.memo_widget_wide,
    )

    /** Only these layouts have the "today" and "next reminder" lines (setting a missing view breaks a widget). */
    private fun hasDay(layout: Int) = layout != R.layout.memo_widget_small

    fun views(context: Context, layout: Int): RemoteViews {
      val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      val views = RemoteViews(context.packageName, layout)
      val signedIn = prefs.getBoolean("signedIn", false)
      if (signedIn) {
        views.setTextViewText(R.id.widget_streak, "🔥 ${prefs.getInt("streak", 0)}")
        if (hasDay(layout)) {
          views.setTextViewText(R.id.widget_today, prefs.getString("today", "") ?: "")
          views.setTextViewText(R.id.widget_next, prefs.getString("next", "") ?: "")
        }
        // The weather Home last saw, while it's still current (3 hours).
        val weather = prefs.getString("weather", "") ?: ""
        val fresh = System.currentTimeMillis() - prefs.getLong("weatherAt", 0L) < 3 * 3600_000L
        views.setTextViewText(R.id.widget_weather, weather)
        views.setViewVisibility(R.id.widget_weather, if (fresh && weather.isNotEmpty()) View.VISIBLE else View.GONE)
      } else {
        views.setViewVisibility(R.id.widget_weather, View.GONE)
        views.setTextViewText(R.id.widget_streak, "🔥 Memo")
        if (hasDay(layout)) {
          views.setTextViewText(R.id.widget_today, "Sign in to see your day")
          views.setTextViewText(R.id.widget_next, "")
        }
      }
      val open = Intent(context, MainActivity::class.java).apply { flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP }
      val tap = PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
      views.setOnClickPendingIntent(R.id.widget_root, tap)
      return views
    }

    /** Redraws every Memo widget on the home screen, of every kind. */
    fun refreshAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      for ((provider, layout) in ALL) {
        for (id in manager.getAppWidgetIds(ComponentName(context, provider))) manager.updateAppWidget(id, views(context, layout))
      }
    }
  }
}

/** "Memo · Melo" (2×2): the weather, Melo animated, and the streak. */
class MemoSmallWidgetProvider : MemoWidgetProvider() {
  override val layout: Int = R.layout.memo_widget_small
}

/** "Memo · Today" (4×1): one slim row with the streak, today, the next reminder and the weather. */
class MemoWideWidgetProvider : MemoWidgetProvider() {
  override val layout: Int = R.layout.memo_widget_wide
}
