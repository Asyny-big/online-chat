package ru.govchat.app.tunnel.core

import android.content.Context
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.net.URI
import java.net.URLDecoder
import ru.govchat.app.BuildConfig
import ru.govchat.app.tunnel.data.ServerManager

object ConfigBuilder {

    private const val TAG = "ConfigBuilder"
    private val supportedTransportTypes = setOf("tcp", "ws", "grpc", "httpupgrade")

    fun buildConfig(context: Context): String {
        val serverManager = ServerManager(context)
        val vlessLinks = serverManager.getCachedServers()

        if (vlessLinks.isEmpty()) {
            throw IllegalStateException("Server cache is empty! Cannot build config.")
        }

        val outboundsArray = JSONArray()
        val serverTags = mutableListOf<String>()

        val directOutbound = JSONObject().apply {
            put("type", "direct")
            put("tag", "direct")
        }
        outboundsArray.put(directOutbound)

        val blockOutbound = JSONObject().apply {
            put("type", "block")
            put("tag", "block")
        }
        outboundsArray.put(blockOutbound)

        vlessLinks.forEachIndexed { index, link ->
            val tag = "proxy-$index"

            try {
                val outbound = parseVlessLink(link, tag)
                outboundsArray.put(outbound)
                serverTags.add(tag)
            } catch (e: Exception) {
                Log.e(TAG, "Error parsing VLESS link: $link", e)
            }
        }

        if (serverTags.isEmpty()) {
            throw IllegalStateException("No VLESS link was successfully parsed!")
        }

        val urlTestOutbound = JSONObject().apply {
            put("type", "urltest")
            put("tag", "proxy")
            put("outbounds", JSONArray(serverTags))
            put("url", "http://cp.cloudflare.com/generate_204")
            put("interval", "3m")
            put("tolerance", 50)
        }

        val finalOutboundsArray = JSONArray()
        finalOutboundsArray.put(urlTestOutbound)
        for (i in 0 until outboundsArray.length()) {
            finalOutboundsArray.put(outboundsArray.getJSONObject(i))
        }

        val inboundsArray = JSONArray()
        val tunInbound = JSONObject().apply {
            put("type", "tun")
            put("tag", "tun-in")
            put("mtu", 1400)
            put("inet4_address", "172.19.0.1/30")
            put("inet6_address", "fdfe:dcba:9876::1/126")
            put("auto_route", true)
            put("strict_route", true)
            put("stack", "system")
            put("endpoint_independent_nat", true)
        }
        inboundsArray.put(tunInbound)

        val routeObject = JSONObject().apply {
            val rulesArray = JSONArray()
            
            rulesArray.put(JSONObject().apply {
                put("ip_cidr", JSONArray(listOf(
                    "10.0.0.0/8",
                    "172.16.0.0/12",
                    "192.168.0.0/16",
                    "fc00::/7"
                )))
                put("outbound", "direct")
            })

            put("rules", rulesArray)
            put("auto_detect_interface", true)
        }

        val finalConfig = JSONObject().apply {
            put("log", JSONObject().apply {
                put("level", SingBoxRunner.getInstance().logLevel())
                put("timestamp", true)
            })
            put("dns", JSONObject().apply {
                put("servers", JSONArray().apply {
                    put(JSONObject().apply {
                        put("tag", "dns-remote")
                        put("address", "https://1.1.1.1/dns-query")
                        put("detour", "proxy")
                    })
                    put(JSONObject().apply {
                        put("tag", "dns-direct")
                        put("address", "8.8.8.8")
                        put("detour", "direct")
                    })
                })
                put("rules", JSONArray().apply {
                    put(JSONObject().apply {
                        put("outbound", "any")
                        put("server", "dns-remote")
                    })
                })
                put("independent_cache", true)
            })
            put("inbounds", inboundsArray)
            put("outbounds", finalOutboundsArray)
            put("route", routeObject)
        }

        Log.i(TAG, "Built sing-box config. servers=${serverTags.size}, logLevel=${SingBoxRunner.getInstance().logLevel()}")
        return finalConfig.toString()
    }

    private fun parseVlessLink(link: String, tag: String): JSONObject {
        val uri = URI(link)
        if (uri.scheme != "vless") throw IllegalArgumentException("Invalid scheme: ${uri.scheme}")

        val uuid = uri.userInfo
        val host = uri.host
        val port = uri.port
        val queryParams = getQueryMap(uri.query)
        require(!uuid.isNullOrBlank()) { "VLESS UUID is missing" }
        require(!host.isNullOrBlank()) { "VLESS host is missing" }
        require(port > 0) { "VLESS port is invalid: $port" }

        val transportType = normalizeTransportType(queryParams["type"])
        val securityType = queryParams["security"] ?: "none"
        require(transportType in supportedTransportTypes) {
            "Unsupported transport type: $transportType"
        }

        val outbound = JSONObject().apply {
            put("type", "vless")
            put("tag", tag)
            put("server", host)
            put("server_port", port)
            put("uuid", uuid)
            put("packet_encoding", "xudp")
        }

        queryParams["flow"]
            ?.takeIf { it.isNotBlank() && it != "none" }
            ?.let { outbound.put("flow", it) }

        if (securityType == "tls" || securityType == "reality") {
            val tlsObject = JSONObject().apply {
                put("enabled", true)
                put("server_name", queryParams["sni"] ?: queryParams["host"] ?: host)
                if ((queryParams["insecure"] ?: queryParams["allowInsecure"]) == "1") {
                    put("insecure", true)
                }
                queryParams["alpn"]
                    ?.split(",")
                    ?.map(String::trim)
                    ?.filter(String::isNotEmpty)
                    ?.takeIf { it.isNotEmpty() }
                    ?.let { put("alpn", JSONArray(it)) }
                queryParams["fp"]
                    ?.takeIf { it.isNotBlank() }
                    ?.let {
                        put("utls", JSONObject().apply {
                            put("enabled", true)
                            put("fingerprint", it)
                        })
                    }
                if (securityType == "reality") {
                    put("reality", JSONObject().apply {
                        put("enabled", true)
                        put("public_key", queryParams["pbk"] ?: "")
                        put("short_id", queryParams["sid"] ?: "")
                    })
                }
            }
            outbound.put("tls", tlsObject)
        }

        val transportObject = JSONObject().apply {
            put("type", transportType)
            when (transportType) {
                "ws" -> {
                    queryParams["path"]?.let { put("path", it) }
                    queryParams["host"]
                        ?.takeIf { it.isNotBlank() }
                        ?.let { headerHost ->
                            put("headers", JSONObject().apply {
                                put("Host", headerHost)
                            })
                        }
                }

                "grpc" -> {
                    queryParams["serviceName"]?.let { put("service_name", it) }
                }

                "httpupgrade" -> {
                    queryParams["path"]?.let { put("path", it) }
                    queryParams["host"]?.let { put("host", it) }
                }
            }
        }
        outbound.put("transport", transportObject)

        return outbound
    }

    private fun getQueryMap(query: String?): Map<String, String> {
        if (query.isNullOrEmpty()) return emptyMap()
        val map = mutableMapOf<String, String>()
        val pairs = query.split("&")
        for (pair in pairs) {
            val idx = pair.indexOf("=")
            if (idx > 0) {
                map[URLDecoder.decode(pair.substring(0, idx), "UTF-8")] = 
                    URLDecoder.decode(pair.substring(idx + 1), "UTF-8")
            }
        }
        return map
    }

    private fun normalizeTransportType(rawType: String?): String {
        return when (rawType?.trim()?.lowercase()) {
            null, "", "tcp" -> "tcp"
            "raw" -> "tcp"
            "ws" -> "ws"
            "grpc" -> "grpc"
            "httpupgrade" -> "httpupgrade"
            "xhttp" -> "xhttp"
            else -> rawType.trim().lowercase()
        }
    }
}
