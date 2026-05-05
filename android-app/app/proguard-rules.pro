# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# Moshi uses reflection for network DTOs in this package.
# Keep names and members to avoid JSON mapping regressions in release builds.
-keep class ru.govchat.app.core.network.** { *; }
-keep class go.** { *; }
-keep class libbox.** { *; }

# Tunnel/VPN module is invoked via reflection and JNI from libbox PlatformInterface,
# and we need diagnostic Log.* calls to survive minification so we can debug
# tunnel issues from logcat. Without this, R8 strips report* methods and Log
# strings, making release builds opaque.
-keep class ru.govchat.app.tunnel.** { *; }
-keepclassmembers class ru.govchat.app.tunnel.TunnelManager {
    public *** report*(...);
    public *** mark*(...);
    public *** is*State();
    public *** get*State();
}

# Preserve sing-box/libbox PlatformInterface implementations and any class that
# overrides its methods so libbox can call them from native Go code.
-keep class * implements libbox.PlatformInterface { *; }

# Preserve Log calls and tags in our packages for release diagnostics.
-keepclassmembers class ru.govchat.app.** {
    private static final java.lang.String TAG;
}

# Keep annotation/metadata information required by Moshi + Kotlin reflection.
-keepattributes RuntimeVisibleAnnotations,RuntimeVisibleParameterAnnotations,Signature,InnerClasses,EnclosingMethod,SourceFile,LineNumberTable
