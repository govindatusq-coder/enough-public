package app.enough.movement

import android.content.Intent
import android.net.Uri
import androidx.activity.result.ActivityResult
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.getcapacitor.*
import com.getcapacitor.annotation.*
import kotlinx.coroutines.*
import org.json.JSONObject
import java.time.*

@CapacitorPlugin(name = "EnoughMovement")
class EnoughMovementPlugin : Plugin() {
    private var enabled = false
    private var generation = 0
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val permissions = setOf(HealthPermission.getReadPermission(StepsRecord::class), HealthPermission.getReadPermission(ExerciseSessionRecord::class))
    private fun trusted(): Boolean {
        val url = Uri.parse(bridge.webView.url ?: "")
        return url.scheme == "https" && url.host == "enough-movement.govindatusq.chatgpt.site" && (url.port == -1 || url.port == 443)
    }
    private fun client(): HealthConnectClient {
        when (HealthConnectClient.getSdkStatus(context)) {
            HealthConnectClient.SDK_AVAILABLE -> return HealthConnectClient.getOrCreate(context)
            HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> error("Install or update Health Connect from Google Play, then try again")
            else -> error("Health Connect is unavailable on this device")
        }
    }
    @PluginMethod
    fun authorize(call: PluginCall) {
        activity.runOnUiThread {
            if (!trusted()) { call.reject("Untrusted origin"); return@runOnUiThread }
            scope.launch {
                try {
                    val client = client()
                    if (client.permissionController.getGrantedPermissions().containsAll(permissions)) {
                        enabled = true; call.resolve(JSObject().put("available", true))
                    } else {
                        val contract = PermissionController.createRequestPermissionResultContract()
                        startActivityForResult(call, contract.createIntent(context, permissions), "permissionResult")
                    }
                } catch (e: Exception) { call.reject(e.message ?: "Health Connect unavailable") }
            }
        }
    }
    @ActivityCallback
    private fun permissionResult(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        scope.launch {
            try {
                if (!trusted()) error("Untrusted origin")
                val granted = client().permissionController.getGrantedPermissions()
                enabled = granted.any { it in permissions }
                if (!enabled) error("Health access not granted")
                call.resolve(JSObject().put("available", true))
            } catch (e: Exception) { call.reject(e.message ?: "Health access not granted") }
        }
    }
    @PluginMethod
    fun disconnect(call: PluginCall) {
        activity.runOnUiThread {
            if (!trusted()) { call.reject("Untrusted origin"); return@runOnUiThread }
            enabled = false; generation++; call.resolve()
        }
    }
    private suspend fun totals(client: HealthConnectClient, start: Instant, end: Instant): JSObject {
        val granted = client.permissionController.getGrantedPermissions()
        val result = JSObject()
        // Aggregation preserves Health Connect's step deduplication and source priorities.
        val steps = if (HealthPermission.getReadPermission(StepsRecord::class) in granted)
            client.aggregate(AggregateRequest(setOf(StepsRecord.COUNT_TOTAL), TimeRangeFilter.between(start, end)))[StepsRecord.COUNT_TOTAL] else null
        val duration = if (HealthPermission.getReadPermission(ExerciseSessionRecord::class) in granted)
            client.aggregate(AggregateRequest(setOf(ExerciseSessionRecord.EXERCISE_DURATION_TOTAL), TimeRangeFilter.between(start, end)))[ExerciseSessionRecord.EXERCISE_DURATION_TOTAL] else null
        result.put("steps", steps ?: JSONObject.NULL)
        result.put("exerciseMinutes", duration?.let { it.toMillis() / 60000.0 } ?: JSONObject.NULL)
        return result
    }
    @PluginMethod
    fun read(call: PluginCall) {
        activity.runOnUiThread {
            if (!trusted() || !enabled) { call.reject("Connect health data first"); return@runOnUiThread }
            val currentGeneration = generation
            scope.launch {
                try {
                    val client = client(); val now = Instant.now(); val zone = ZoneId.systemDefault()
                    val startText = call.getString("start"); val endText = call.getString("end")
                    val response: JSObject
                    if (startText != null && endText != null) {
                        val start = Instant.parse(startText); val end = Instant.parse(endText)
                        if (start >= end || end > now || Duration.between(start, end).seconds > 86400 || Duration.between(start, now).seconds > 15 * 86400) error("Invalid movement window")
                        response = totals(client, start, end).put("source", "health-connect").put("start", startText).put("end", endText).put("readAt", now.toString())
                    } else {
                        val days = JSArray(); val today = LocalDate.now(zone)
                        for (offset in -14L..0L) {
                            if (!trusted() || !enabled || currentGeneration != generation) error("Reading cancelled")
                            val day = today.plusDays(offset)
                            val start = day.atStartOfDay(zone).toInstant(); val end = minOf(day.plusDays(1).atStartOfDay(zone).toInstant(), now)
                            days.put(totals(client, start, end).put("date", day.toString()))
                        }
                        response = JSObject().put("source", "health-connect").put("timezone", zone.id).put("readAt", now.toString()).put("days", days)
                    }
                    if (!trusted() || !enabled || currentGeneration != generation) error("Reading cancelled")
                    call.resolve(response)
                } catch (e: Exception) { call.reject(e.message ?: "Movement data unreadable") }
            }
        }
    }
    override fun handleOnDestroy() { scope.cancel(); super.handleOnDestroy() }
}
