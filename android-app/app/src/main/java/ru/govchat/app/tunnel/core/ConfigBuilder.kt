package ru.govchat.app.tunnel.core

import android.content.Context
import android.util.Log
import ru.govchat.app.tunnel.data.ServerManager
import org.json.JSONArray
import org.json.JSONObject
import java.net.URI
import java.net.URLDecoder

object ConfigBuilder {

    private const val TAG = "ConfigBuilder"

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
            serverTags.add(tag)

            try {
                val outbound = parseVlessLink(link, tag)
                outboundsArray.put(outbound)
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
            put("inet4_address", "172.19.0.1/30") 
            put("inet6_address", "fdfe:dcba:9876::1/126")
            put("auto_route", false)
            put("strict_route", false)
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
                put("level", "info")
            })
            put("dns", JSONObject().apply {
                put("servers", JSONArray().apply {
                    put(JSONObject().apply {
                        put("tag", "dns-remote")
                        put("address", "https://1.1.1.1/dns-query")
                        put("detour", "proxy")
                    })
                })
                put("rules", JSONArray().apply {
                    put(JSONObject().apply {
                        put("outbound", "any")
                        put("server", "dns-remote")
                    })
                })
            })
            put("inbounds", inboundsArray)
            put("outbounds", finalOutboundsArray)
            put("route", routeObject)
        }

        return finalConfig.toString()
    }

    private fun parseVlessLink(link: String, tag: String): JSONObject {
        val uri = URI(link)
        if (uri.scheme != "vless") throw IllegalArgumentException("Invalid scheme: ${uri.scheme}")

        val uuid = uri.userInfo
        val host = uri.host
        val port = uri.port
        val queryParams = getQueryMap(uri.query)

        val outbound = JSONObject().apply {
            put("type", "vless")
            put("tag", tag)
            put("server", host)
            put("server_port", port)
            put("uuid", uuid)
            put("flow", queryParams["flow"] ?: "xtls-rprx-vision")
            put("packet_encoding", "xudp")
        }

        if (queryParams["security"] == "reality") {
            val tlsObject = JSONObject().apply {
                put("enabled", true)
                put("server_name", queryParams["sni"] ?: host)
                put("reality", JSONObject().apply {
                    put("enabled", true)
                    put("public_key", queryParams["pbk"] ?: "")
                    put("short_id", queryParams["sid"] ?: "")
                })
            }
            outbound.put("tls", tlsObject)
        }

        val transportObject = JSONObject().apply {
            put("type", queryParams["type"] ?: "tcp")
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
}
