package com.myapp

import android.content.Context
import android.media.AudioManager
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * The soft key click played on taps when "Tap sound" is on in Settings. It
 * uses the phone's own click (no sound file), and plays even if the phone's
 * touch sounds are off, since the user turned it on in Memo.
 */
class TapSoundModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private val audio by lazy { reactApplicationContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager }

  override fun getName() = "TapSound"

  @ReactMethod
  fun click() {
    audio.playSoundEffect(AudioManager.FX_KEY_CLICK, VOLUME)
  }

  companion object {
    private const val VOLUME = 0.5f
  }
}
