package com.myapp

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Geocoder
import android.location.Location
import android.location.LocationManager
import android.os.Build
import android.os.CancellationSignal
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * The phone's rough location (city level, from the network; no GPS), only for
 * the weather on Home. Resolves {latitude, longitude, city} (city may be
 * missing) or null when the permission isn't given or nothing is known.
 * Never stored or sent to Memo's server.
 */
class MemoLocationModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "MemoLocation"

  @ReactMethod
  fun approximate(promise: Promise) {
    val context = reactApplicationContext.applicationContext
    if (ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
      promise.resolve(null)
      return
    }
    val manager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    try {
      val known = manager.getProviders(true)
        .mapNotNull { runCatching { manager.getLastKnownLocation(it) }.getOrNull() }
        .maxByOrNull { it.time }
      // Anything from the last 6 hours is close enough for the weather.
      if (known != null && System.currentTimeMillis() - known.time < 6 * 3600_000L) {
        Thread { promise.resolve(toMap(known)) }.start()
        return
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
        manager.getCurrentLocation(LocationManager.NETWORK_PROVIDER, CancellationSignal(), ContextCompat.getMainExecutor(context)) { fresh ->
          val found = fresh ?: known
          if (found == null) promise.resolve(null) else Thread { promise.resolve(toMap(found)) }.start()
        }
        return
      }
      if (known == null) promise.resolve(null) else Thread { promise.resolve(toMap(known)) }.start()
    } catch (e: SecurityException) {
      promise.resolve(null)
    }
  }

  /** Runs off the main thread: the city name comes from the phone's Geocoder. */
  private fun toMap(location: Location) = Arguments.createMap().apply {
    putDouble("latitude", location.latitude)
    putDouble("longitude", location.longitude)
    cityOf(location)?.let { putString("city", it) }
  }

  @Suppress("DEPRECATION")
  private fun cityOf(location: Location): String? = try {
    if (!Geocoder.isPresent()) null
    else Geocoder(reactApplicationContext).getFromLocation(location.latitude, location.longitude, 1)
      ?.firstOrNull()
      ?.let { it.locality ?: it.subAdminArea ?: it.adminArea }
  } catch (e: Exception) {
    null
  }
}
