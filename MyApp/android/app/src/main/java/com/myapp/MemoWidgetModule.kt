package com.myapp

import android.content.Context
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/** Lets the app hand the home-screen widget its latest numbers. */
class MemoWidgetModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "MemoWidget"

  @ReactMethod
  fun update(signedIn: Boolean, streak: Double, today: String, next: String) {
    val context = reactApplicationContext.applicationContext
    context
      .getSharedPreferences(MemoWidgetProvider.PREFS, Context.MODE_PRIVATE)
      .edit()
      .putBoolean("signedIn", signedIn)
      .putInt("streak", streak.toInt())
      .putString("today", today)
      .putString("next", next)
      .apply()
    MemoWidgetProvider.refreshAll(context)
  }
}
