package ru.govchat.app.tunnel.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class ConfigBuilderTest {

    @Test
    fun parseVlessLink_normalizesUppercaseUtlsFingerprint() {
        val outbound = ConfigBuilder.parseVlessLinkForTest(
            vlessLink(fp = "QQ"),
            tag = "proxy-test"
        )

        val fingerprint = outbound
            .getJSONObject("tls")
            .getJSONObject("utls")
            .getString("fingerprint")

        assertEquals("qq", fingerprint)
    }

    @Test
    fun parseVlessLink_mapsLegacyChromeFingerprintToChrome() {
        val outbound = ConfigBuilder.parseVlessLinkForTest(
            vlessLink(fp = "chrome_psk_shuffle"),
            tag = "proxy-test"
        )

        val fingerprint = outbound
            .getJSONObject("tls")
            .getJSONObject("utls")
            .getString("fingerprint")

        assertEquals("chrome", fingerprint)
    }

    @Test
    fun parseVlessLink_fallsBackUnknownUtlsFingerprintToChrome() {
        val outbound = ConfigBuilder.parseVlessLinkForTest(
            vlessLink(fp = "QQBrowser"),
            tag = "proxy-test"
        )

        val fingerprint = outbound
            .getJSONObject("tls")
            .getJSONObject("utls")
            .getString("fingerprint")

        assertEquals("chrome", fingerprint)
    }

    @Test
    fun parseVlessLink_mapsRawTransportToTcpWithoutTransportBlock() {
        val outbound = ConfigBuilder.parseVlessLinkForTest(
            vlessLink(type = "raw"),
            tag = "proxy-test"
        )

        assertFalse(outbound.has("transport"))
    }

    private fun vlessLink(
        fp: String = "chrome",
        type: String = "tcp"
    ): String {
        return "vless://11111111-1111-1111-1111-111111111111@example.com:443" +
            "?security=reality" +
            "&sni=example.com" +
            "&fp=$fp" +
            "&pbk=public-key" +
            "&sid=abcd" +
            "&type=$type" +
            "&flow=xtls-rprx-vision"
    }
}
