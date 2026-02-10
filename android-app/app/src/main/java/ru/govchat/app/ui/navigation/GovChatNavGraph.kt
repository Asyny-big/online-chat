package ru.govchat.app.ui.navigation

import androidx.compose.runtime.Composable
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
    navController: NavHostController = rememberNavController()
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
                factory = LoginViewModel.factory(container.loginUseCase)
            )
            val uiState = viewModel.state.collectAsStateWithLifecycle().value

            LoginScreen(
                state = uiState,
                onPhoneChanged = viewModel::updatePhone,
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
                factory = MainViewModel.factory(container.loadChatsUseCase, container.chatRepository)
            )
            val state = viewModel.state.collectAsStateWithLifecycle().value

            MainScreen(
                state = state,
                onRefresh = viewModel::refresh
            )
        }
    }
}
