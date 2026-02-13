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
import ru.govchat.app.domain.usecase.LoadMessagesUseCase
import ru.govchat.app.domain.usecase.LoadChatsUseCase
import ru.govchat.app.domain.usecase.LoadWebRtcConfigUseCase
import ru.govchat.app.domain.usecase.LoginUseCase
import ru.govchat.app.domain.usecase.LogoutUseCase
import ru.govchat.app.domain.usecase.RegisterUseCase
import ru.govchat.app.domain.usecase.AcceptCallUseCase
import ru.govchat.app.domain.usecase.DeclineCallUseCase
import ru.govchat.app.domain.usecase.JoinGroupCallUseCase
import ru.govchat.app.domain.usecase.LeaveCallUseCase
import ru.govchat.app.domain.usecase.LeaveGroupCallUseCase
import ru.govchat.app.domain.usecase.SendAttachmentMessageUseCase
import ru.govchat.app.domain.usecase.SendCallSignalUseCase
import ru.govchat.app.domain.usecase.SendGroupCallSignalUseCase
import ru.govchat.app.domain.usecase.SendTextMessageUseCase
import ru.govchat.app.domain.usecase.StartCallUseCase
import ru.govchat.app.domain.usecase.StartGroupCallUseCase
import ru.govchat.app.domain.usecase.SearchUserByPhoneUseCase
import ru.govchat.app.domain.usecase.CreateChatUseCase
import ru.govchat.app.domain.usecase.CreateGroupChatUseCase

class AppContainer(application: Application) {
    val appContext = application.applicationContext

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
    val chatRepository: ChatRepository = ChatRepositoryImpl(
        appContext = application.applicationContext,
        api = api,
        socketGateway = socketGateway,
        sessionStorage = sessionStorage
    )
    val deviceRepository: DeviceRepository = DeviceRepositoryImpl(api, sessionStorage)

    val checkSessionUseCase = CheckSessionUseCase(authRepository)
    val loginUseCase = LoginUseCase(authRepository)
    val registerUseCase = RegisterUseCase(authRepository)
    val logoutUseCase = LogoutUseCase(authRepository)
    val loadChatsUseCase = LoadChatsUseCase(chatRepository)
    val loadMessagesUseCase = LoadMessagesUseCase(chatRepository)
    val sendTextMessageUseCase = SendTextMessageUseCase(chatRepository)
    val sendAttachmentMessageUseCase = SendAttachmentMessageUseCase(chatRepository)
    val loadWebRtcConfigUseCase = LoadWebRtcConfigUseCase(chatRepository)
    val sendCallSignalUseCase = SendCallSignalUseCase(chatRepository)
    val sendGroupCallSignalUseCase = SendGroupCallSignalUseCase(chatRepository)
    val startCallUseCase = StartCallUseCase(chatRepository)
    val acceptCallUseCase = AcceptCallUseCase(chatRepository)
    val declineCallUseCase = DeclineCallUseCase(chatRepository)
    val leaveCallUseCase = LeaveCallUseCase(chatRepository)
    val startGroupCallUseCase = StartGroupCallUseCase(chatRepository)
    val joinGroupCallUseCase = JoinGroupCallUseCase(chatRepository)
    val leaveGroupCallUseCase = LeaveGroupCallUseCase(chatRepository)
    val searchUserByPhoneUseCase = SearchUserByPhoneUseCase(chatRepository)
    val createChatUseCase = CreateChatUseCase(chatRepository)
    val createGroupChatUseCase = CreateGroupChatUseCase(chatRepository)
}

