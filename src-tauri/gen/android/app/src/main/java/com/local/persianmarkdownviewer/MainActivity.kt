package com.local.persianmarkdownviewer

import android.os.Bundle
import android.content.Context
import android.print.PrintAttributes
import android.print.PrintManager
import android.print.PrintDocumentAdapter
import android.print.PageRange
import android.os.CancellationSignal
import android.os.ParcelFileDescriptor
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import kotlin.math.roundToInt
import org.json.JSONObject

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }

  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)
    webView.addJavascriptInterface(AndroidPdfExporter(webView), "AndroidPdfExporter")
  }

  private inner class AndroidPdfExporter(private val webView: WebView) {
    private var printing = false

    private fun finished(requestId: String, error: String? = null) {
      val detail = JSONObject().put("id", requestId)
      if (error != null) detail.put("error", error)
      webView.evaluateJavascript(
        "window.dispatchEvent(new CustomEvent('pmv-android-print-finished',{detail:$detail}));", null
      )
    }

    @JavascriptInterface
    fun exportPdf(name: String, widthMm: Double, heightMm: Double, marginMm: Double, requestId: String) {
      runOnUiThread {
        if (printing) {
          finished(requestId, "یک کار چاپ در حال اجراست.")
          return@runOnUiThread
        }
        if (!widthMm.isFinite() || !heightMm.isFinite() || !marginMm.isFinite() ||
            widthMm !in 50.0..1000.0 || heightMm !in 50.0..1000.0 ||
            marginMm !in 0.0..50.0 || 2 * marginMm + 10 > minOf(widthMm, heightMm)) {
          finished(requestId, "اندازهٔ صفحه یا حاشیه معتبر نیست.")
          return@runOnUiThread
        }
        printing = true
        try {
        val toMils = { value: Double -> (value / 25.4 * 1000).roundToInt() }
        val width = toMils(widthMm)
        val height = toMils(heightMm)
        val margin = toMils(marginMm)
        // Standard media IDs keep the service's paper selector consistent.
        val portraitWidth = minOf(width, height)
        val portraitHeight = maxOf(width, height)
        val paper = when {
          kotlin.math.abs(portraitWidth - PrintAttributes.MediaSize.ISO_A4.widthMils) <= 1 &&
            kotlin.math.abs(portraitHeight - PrintAttributes.MediaSize.ISO_A4.heightMils) <= 1 -> PrintAttributes.MediaSize.ISO_A4
          kotlin.math.abs(portraitWidth - PrintAttributes.MediaSize.NA_LETTER.widthMils) <= 1 &&
            kotlin.math.abs(portraitHeight - PrintAttributes.MediaSize.NA_LETTER.heightMils) <= 1 -> PrintAttributes.MediaSize.NA_LETTER
          else -> PrintAttributes.MediaSize("persian-markdown-custom", "Persian Markdown", portraitWidth, portraitHeight)
        }
        val media = if (width > height) paper.asLandscape() else paper.asPortrait()
        val attributes = PrintAttributes.Builder()
          .setMediaSize(media)
          .setMinMargins(PrintAttributes.Margins(margin, margin, margin, margin))
          .setResolution(PrintAttributes.Resolution("pdf", "PDF", 600, 600))
          .setColorMode(PrintAttributes.COLOR_MODE_COLOR)
          .build()
        val manager = getSystemService(Context.PRINT_SERVICE) as PrintManager
        val title = name.take(200).ifBlank { "Document.pdf" }
        val delegate = webView.createPrintDocumentAdapter(title)
        val adapter = object : PrintDocumentAdapter() {
          override fun onStart() { delegate.onStart() }
          override fun onLayout(oldAttributes: PrintAttributes?, newAttributes: PrintAttributes,
            cancellationSignal: CancellationSignal, callback: LayoutResultCallback, extras: Bundle?) {
            // Switching from a remembered physical printer to Save as PDF can
            // reset minMargins to zero. Keep the user's page-modifier margins
            // on EVERY layout, while respecting a printer's nonprintable area.
            val serviceMargins = newAttributes.minMargins ?: PrintAttributes.Margins.NO_MARGINS
            val effective = PrintAttributes.Builder().apply {
                newAttributes.mediaSize?.let { setMediaSize(it) }
                newAttributes.resolution?.let { setResolution(it) }
                if (newAttributes.colorMode != 0) setColorMode(newAttributes.colorMode)
                if (newAttributes.duplexMode != 0) setDuplexMode(newAttributes.duplexMode)
              }
              .setMinMargins(PrintAttributes.Margins(
                maxOf(margin, serviceMargins.leftMils), maxOf(margin, serviceMargins.topMils),
                maxOf(margin, serviceMargins.rightMils), maxOf(margin, serviceMargins.bottomMils)))
              .build()
            delegate.onLayout(oldAttributes, effective, cancellationSignal, callback, extras)
          }
          override fun onWrite(pages: Array<PageRange>, destination: ParcelFileDescriptor,
            cancellationSignal: CancellationSignal, callback: WriteResultCallback) {
            delegate.onWrite(pages, destination, cancellationSignal, callback)
          }
          override fun onFinish() {
            try { delegate.onFinish() } finally {
              printing = false
              finished(requestId)
            }
          }
        }
        manager.print(title, adapter, attributes)
        } catch (error: Exception) {
          printing = false
          finished(requestId, "چاپ اندروید آغاز نشد. دوباره تلاش کنید.")
          android.util.Log.e("AndroidPdfExporter", "Unable to start print job", error)
        }
      }
    }
  }
}
