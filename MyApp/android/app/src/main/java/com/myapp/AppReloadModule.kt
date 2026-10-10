package com.myapp

import com.facebook.react.ReactApplication
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil

/**
 * Restarts the JavaScript side of the app in place (no process restart), so
 * a new theme or accent applies at once: every screen's styles are built
 * when the JS starts, from the theme saved on the device.
 */
class AppReloadModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "AppReload"

  @ReactMethod
  fun reload(reason: String) {
    val app = reactApplicationContext.applicationContext as ReactApplication
    UiThreadUtil.runOnUiThread { app.reactHost?.reload(reason) }
  }
}
