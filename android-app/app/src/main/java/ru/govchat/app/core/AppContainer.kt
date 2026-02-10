package ru.govchat.app.core

import android.app.Application
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import ru.govchat.app.BuildConfig
import ru.govchat.app.core.network.AuthInterceptor
import ru.govchat.app.core.network.GovChatApi
import ru.govchat.app.core.network.SocketGateway
import ru.govchat.app.core.storage.SessionStorage
import ru.govchat.app.data.repository.AuthRepositoryImpl
import ru.govchat.app.data.repository.ChatRepositoryImpl
import ru.govchat.app.data.repository.DeviceRepositoryImpl
import ru.govchat.app.domain.repository.AuthRepository
import ru.govchat.app.domain.repository.ChatRepository
import ru.govchat.app.domain.repository.DeviceRepository
import ru.govchat.app.domain.usecase.CheckSessionUseCase
import ru.govchat.app.domain.usecase.LoadChatsUseCase
import ru.govchat.app.domain.usecase.LoginUseCase

class AppContainer(application: Application) {

    val applicationScope: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    val sessionStorage: SessionStorage = SessionStorage(
        appContext = application.applicationContext,
        applicationScope = applicationScope
    )

    private val authInterceptor = AuthInterceptor(sessionStorage)

    private val okHttpClient: OkHttpClient = OkHttpClient.Builder()
        .addInterceptor(authInterceptor)
        .apply {
            if (BuildConfig.DEBUG) {
                addInterceptor(
                    HttpLoggingInterceptor().apply {
                        level = HttpLoggingInterceptor.Level.BODY
                    }
                )
            }
        }
        .build()

    private val moshi: Moshi = Moshi.Builder()
        .add(KotlinJsonAdapterFactory())
        .build()

    private val retrofit: Retrofit = Retrofit.Builder()
        .baseUrl(BuildConfig.API_BASE_URL)
        .client(okHttpClient)
        .addConverterFactory(MoshiConverterFactory.create(moshi))
        .build()

    private val api: GovChatApi = retrofit.create(GovChatApi::class.java)
    private val socketGateway = SocketGateway(
        baseUrl = BuildConfig.SOCKET_BASE_URL,
        applicationScope = applicationScope
    )

    val authRepository: AuthRepository = AuthRepositoryImpl(api, sessionStorage)
    val chatRepository: ChatRepository = ChatRepositoryImpl(api, socketGateway, sessionStorage)
    val deviceRepository: DeviceRepository = DeviceRepositoryImpl(api, sessionStorage)

    val checkSessionUseCase = CheckSessionUseCase(authRepository)
    val loginUseCase = LoginUseCase(authRepository)
    val loadChatsUseCase = LoadChatsUseCase(chatRepository)
}

