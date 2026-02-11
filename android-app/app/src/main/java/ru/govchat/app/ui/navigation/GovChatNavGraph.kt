package ru.govchat.app.ui.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import kotlinx.coroutines.flow.collect
import ru.govchat.app.core.AppContainer
import ru.govchat.app.ui.screens.login.LoginEffect
import ru.govchat.app.ui.screens.login.LoginScreen
import ru.govchat.app.ui.screens.login.LoginViewModel
import ru.govchat.app.ui.screens.main.MainScreen
import ru.govchat.app.ui.screens.main.MainViewModel
import ru.govchat.app.ui.screens.splash.SplashScreen
import ru.govchat.app.ui.screens.splash.SplashState
import ru.govchat.app.ui.screens.splash.SplashViewModel

@Composable
fun GovChatNavGraph(
    container: AppContainer,
    navController: NavHostController = rememberNavController(),
    isInPictureInPictureMode: Boolean = false,
    onCallPipAvailabilityChanged: (Boolean) -> Unit = {}
) {
    NavHost(
        navController = navController,
        startDestination = GovChatDestination.Splash.route
    ) {
        composable(GovChatDestination.Splash.route) {
            val viewModel: SplashViewModel = viewModel(
                factory = SplashViewModel.factory(container.checkSessionUseCase)
            )
            val state = viewModel.state.collectAsStateWithLifecycle().value

            SplashScreen()

            LaunchedEffect(state) {
                when (state) {
                    SplashState.Authorized -> {
                        navController.navigate(GovChatDestination.Main.route) {
                            popUpTo(GovChatDestination.Splash.route) { inclusive = true }
                        }
                    }

                    SplashState.Unauthorized -> {
                        navController.navigate(GovChatDestination.Login.route) {
                            popUpTo(GovChatDestination.Splash.route) { inclusive = true }
                        }
                    }

                    SplashState.Loading -> Unit
                }
            }
        }

        composable(GovChatDestination.Login.route) {
            val viewModel: LoginViewModel = viewModel(
                factory = LoginViewModel.factory(
                    loginUseCase = container.loginUseCase,
                    registerUseCase = container.registerUseCase
                )
            )
            val uiState = viewModel.state.collectAsStateWithLifecycle().value

            LoginScreen(
                state = uiState,
                onModeChanged = viewModel::switchMode,
                onPhoneChanged = viewModel::updatePhone,
                onNameChanged = viewModel::updateName,
                onPasswordChanged = viewModel::updatePassword,
                onLoginClick = viewModel::submit
            )

            LaunchedEffect(viewModel) {
                viewModel.effect.collect { effect ->
                    if (effect == LoginEffect.NavigateMain) {
                        navController.navigate(GovChatDestination.Main.route) {
                            popUpTo(GovChatDestination.Login.route) { inclusive = true }
                        }
                    }
                }
            }
        }

        composable(GovChatDestination.Main.route) {
            val viewModel: MainViewModel = viewModel(
                factory = MainViewModel.factory(
                    appContext = container.appContext,
                    loadChatsUseCase = container.loadChatsUseCase,
                    loadMessagesUseCase = container.loadMessagesUseCase,
                    sendTextMessageUseCase = container.sendTextMessageUseCase,
                    sendAttachmentMessageUseCase = container.sendAttachmentMessageUseCase,
                    loadWebRtcConfigUseCase = container.loadWebRtcConfigUseCase,
                    sendCallSignalUseCase = container.sendCallSignalUseCase,
                    startCallUseCase = container.startCallUseCase,
                    acceptCallUseCase = container.acceptCallUseCase,
                    declineCallUseCase = container.declineCallUseCase,
                    leaveCallUseCase = container.leaveCallUseCase,
                    startGroupCallUseCase = container.startGroupCallUseCase,
                    joinGroupCallUseCase = container.joinGroupCallUseCase,
                    leaveGroupCallUseCase = container.leaveGroupCallUseCase,
                    logoutUseCase = container.logoutUseCase,
                    searchUserByPhoneUseCase = container.searchUserByPhoneUseCase,
                    createChatUseCase = container.createChatUseCase,
                    chatRepository = container.chatRepository,
                    authRepository = container.authRepository
                )
            )
            val state = viewModel.state.collectAsStateWithLifecycle().value
            val callUiState = viewModel.callUiState.collectAsStateWithLifecycle().value
            val canEnterPip = state.activeCall?.let { active ->
                !active.isGroup && active.type == "video"
            } ?: false

            LaunchedEffect(canEnterPip) {
                onCallPipAvailabilityChanged(canEnterPip)
            }
            DisposableEffect(Unit) {
                onDispose {
                    onCallPipAvailabilityChanged(false)
                }
            }

            LaunchedEffect(state.sessionExpired) {
                if (state.sessionExpired) {
                    navController.navigate(GovChatDestination.Login.route) {
                        popUpTo(GovChatDestination.Main.route) { inclusive = true }
                    }
                }
            }

            MainScreen(
                state = state,
                callUiState = callUiState,
                isInPictureInPictureMode = isInPictureInPictureMode,
                onRefresh = viewModel::refreshChats,
                onSelectChat = viewModel::selectChat,
                onBackFromChat = viewModel::clearSelectedChat,
                onSendText = viewModel::sendTextMessage,
                onInputChanged = viewModel::onInputChanged,
                onSendAttachment = viewModel::sendAttachment,
                onStartCall = viewModel::startCall,
                onStartGroupCall = viewModel::startGroupCall,
                onAcceptIncomingCall = viewModel::acceptIncomingCall,
                onDeclineIncomingCall = viewModel::declineIncomingCall,
                onLeaveCall = viewModel::leaveActiveCall,
                onToggleCallMinimized = viewModel::toggleCallMinimized,
                onExpandMinimizedCall = viewModel::expandMinimizedCall,
                onCallSurfaceInteraction = viewModel::onCallSurfaceInteraction,
                onToggleMicrophone = viewModel::toggleMicrophone,
                onToggleCamera = viewModel::toggleCamera,
                onSwitchCamera = viewModel::switchCamera,
                onStartScreenShare = viewModel::startScreenShare,
                onStopScreenShare = viewModel::stopScreenShare,
                onClearCallError = viewModel::clearCallError,
                onLogout = viewModel::logout,
                onSearchUserByPhone = viewModel::searchUserByPhone,
                onCreateChatWithUser = viewModel::createChatWithUser,
                onResetUserSearch = viewModel::resetUserSearch,
                onRefreshProfile = viewModel::refreshProfile
            )
        }
    }
}
