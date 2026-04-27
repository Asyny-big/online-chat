package ru.govchat.app.tunnel.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ConfigBuilderTest {

    @Test
    fun parseVlessLink_includesUtlsFingerprintForCurrentLibboxBuild() {
        val outbound = ConfigBuilder.parseVlessLinkForTest(
            vlessLink(security = "tls", fp = "chrome"),
            tag = "proxy-test"
        )

        val tls = outbound.getJSONObject("tls")
        assertTrue(tls.has("utls"))
        val utls = tls.getJSONObject("utls")
        assertTrue(utls.getBoolean("enabled"))
        assertEquals("chrome", utls.getString("fingerprint"))
    }

    @Test
    fun parseVlessLink_acceptsRealityWithUtls() {
        val outbound = ConfigBuilder.parseVlessLinkForTest(
            vlessLink(security = "reality"),
            tag = "proxy-test"
        )

        val tls = outbound.getJSONObject("tls")
        assertTrue(tls.getBoolean("enabled"))
        val reality = tls.getJSONObject("reality")
        assertTrue(reality.getBoolean("enabled"))
        assertEquals("public-key", reality.getString("public_key"))
        assertEquals("abcd", reality.getString("short_id"))
        val utls = tls.getJSONObject("utls")
        assertTrue(utls.getBoolean("enabled"))
        assertEquals("chrome", utls.getString("fingerprint"))
    }

    @Test
    fun parseVlessLink_keepsTlsSecurityEnabled() {
        val outbound = ConfigBuilder.parseVlessLinkForTest(
            vlessLink(security = "tls"),
            tag = "proxy-test"
        )

        assertEquals(true, outbound.getJSONObject("tls").getBoolean("enabled"))
    }

    @Test
    fun parseVlessLink_mapsRawTransportToTcpWithoutTransportBlock() {
        val outbound = ConfigBuilder.parseVlessLinkForTest(
            vlessLink(security = "tls", type = "raw"),
            tag = "proxy-test"
        )

        assertFalse(outbound.has("transport"))
    }

    private fun vlessLink(
        security: String = "reality",
        fp: String = "chrome",
        type: String = "tcp"
    ): String {
        return "vless://11111111-1111-1111-1111-111111111111@example.com:443" +
            "?security=$security" +
            "&sni=example.com" +
            "&fp=$fp" +
            "&pbk=public-key" +
            "&sid=abcd" +
            "&type=$type" +
            "&flow=xtls-rprx-vision"
    }
}
