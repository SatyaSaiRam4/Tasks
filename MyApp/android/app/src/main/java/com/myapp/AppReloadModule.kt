package com.myapp

import android.graphics.Bitmap
import android.graphics.Canvas
import android.os.Handler
import android.os.Looper
import android.view.ViewGroup
import android.widget.ImageView
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil

/**
 * Restarts the JavaScript side of the app in place (no process restart), so
 * a new theme or accent applies at once: every screen's styles are built
 * when the JS starts, from the theme saved on the device.
 *
 * So the restart isn't seen, a snapshot of the current screen is laid over
 * the window first. The JS calls hideCover() once the new screen is drawn,
 * and the snapshot fades away (or after COVER_TIMEOUT_MS, whatever happens).
 */
class AppReloadModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "AppReload"

  @ReactMethod
  fun reload(reason: String) {
    UiThreadUtil.runOnUiThread {
      showCover()
      val app = reactApplicationContext.applicationContext as ReactApplication
      // One frame later, so the cover is on screen before anything changes.
      Handler(Looper.getMainLooper()).post { app.reactHost?.reload(reason) }
    }
  }

  @ReactMethod
  fun hideCover() {
    UiThreadUtil.runOnUiThread { fadeOutCover() }
  }

  private fun showCover() {
    val activity = reactApplicationContext.currentActivity ?: return
    val decor = activity.window.decorView as ViewGroup
    if (decor.width == 0 || decor.height == 0) return
    decor.findViewWithTag<ImageView>(COVER_TAG)?.let { decor.removeView(it) }
    val snapshot = Bitmap.createBitmap(decor.width, decor.height, Bitmap.Config.ARGB_8888)
    decor.draw(Canvas(snapshot))
    val cover =
      ImageView(activity).apply {
        tag = COVER_TAG
        setImageBitmap(snapshot)
        scaleType = ImageView.ScaleType.FIT_XY
        isClickable = true // swallow touches while the app restarts underneath
        elevation = 1000f
      }
    decor.addView(cover, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
    Handler(Looper.getMainLooper()).postDelayed({ fadeOutCover() }, COVER_TIMEOUT_MS)
  }

  private fun fadeOutCover() {
    val activity = reactApplicationContext.currentActivity ?: return
    val decor = activity.window.decorView as ViewGroup
    val cover = decor.findViewWithTag<ImageView>(COVER_TAG) ?: return
    cover.tag = null // a second call won't find it again
    cover.animate().alpha(0f).setDuration(320).withEndAction { decor.removeView(cover) }.start()
  }

  companion object {
    private const val COVER_TAG = "memo-reload-cover"
    private const val COVER_TIMEOUT_MS = 4000L
  }
}
