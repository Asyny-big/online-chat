package ru.govchat.app.tunnel.network

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.util.Log
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

class NetworkStateTracker(private val context: Context) {

    private val connectivityManager =
        context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

    private val _isRestrictedNetwork = MutableStateFlow(false)
    val isRestrictedNetwork: StateFlow<Boolean> = _isRestrictedNetwork

    private val _isConnected = MutableStateFlow(true)
    val isConnected: StateFlow<Boolean> = _isConnected

    private val networkCallback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            _isConnected.value = true
            checkNetworkRestrictions(network)
        }

        override fun onLost(network: Network) {
            _isConnected.value = false
            _isRestrictedNetwork.value = false // Default when no network
        }

        override fun onCapabilitiesChanged(
            network: Network,
            networkCapabilities: NetworkCapabilities
        ) {
            checkNetworkRestrictions(network, networkCapabilities)
        }
    }

    fun startTracking() {
        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()
        connectivityManager.registerNetworkCallback(request, networkCallback)
        
        // Initial check
        val activeNetwork = connectivityManager.activeNetwork
        if (activeNetwork != null) {
            _isConnected.value = true
            checkNetworkRestrictions(activeNetwork)
        } else {
            _isConnected.value = false
        }
    }

    fun stopTracking() {
        try {
            connectivityManager.unregisterNetworkCallback(networkCallback)
        } catch (e: Exception) {
            Log.e("NetworkStateTracker", "Error unregistering callback", e)
        }
    }

    private fun checkNetworkRestrictions(network: Network, capabilities: NetworkCapabilities? = null) {
        val caps = capabilities ?: connectivityManager.getNetworkCapabilities(network) ?: return
        
        // Example heuristics for restricted network (Russia mobile networks logic):
        // If it's cellular, we assume it MIGHT be restricted. 
        // In a real production app, you might want to make an HTTP request to your backend
        // (e.g. https://govchat.ru/api/ping). If it fails/times out but Google is accessible,
        // it means your specific backend is blocked -> restricted = true.
        
        val isCellular = caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)
        val isWifi = caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)

        // For this implementation, we simply flag Cellular as potentially restricted.
        // You should replace this with actual ping logic.
        if (isCellular) {
            Log.d("NetworkStateTracker", "Cellular network detected. Assuming restricted/white-list mode.")
            _isRestrictedNetwork.value = true
        } else if (isWifi) {
            Log.d("NetworkStateTracker", "WiFi network detected. Assuming unrestricted.")
            _isRestrictedNetwork.value = false
        }
    }
}
