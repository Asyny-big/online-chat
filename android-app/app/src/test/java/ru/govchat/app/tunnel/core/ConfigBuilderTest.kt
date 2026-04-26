package ru.govchat.app.tunnel.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Test

class ConfigBuilderTest {

    @Test
    fun parseVlessLink_omitsUtlsFingerprintForCurrentLibboxBuild() {
        val outbound = ConfigBuilder.parseVlessLinkForTest(
            vlessLink(security = "tls", fp = "QQ"),
            tag = "proxy-test"
        )

        assertFalse(outbound.getJSONObject("tls").has("utls"))
    }

    @Test
    fun parseVlessLink_rejectsRealityWhenCurrentLibboxHasNoUtls() {
        val error = assertThrows(IllegalArgumentException::class.java) {
            ConfigBuilder.parseVlessLinkForTest(
                vlessLink(security = "reality"),
                tag = "proxy-test"
            )
        }

        assertEquals(
            "Reality requires uTLS, but current libbox.aar was built without with_utls",
            error.message
        )
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
