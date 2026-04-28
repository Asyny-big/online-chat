package ru.govchat.app.ui.screens.splash

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import ru.govchat.app.core.ui.viewModelFactory
import ru.govchat.app.domain.usecase.CheckSessionUseCase

class SplashViewModel(
    private val checkSessionUseCase: CheckSessionUseCase
) : ViewModel() {

    private val mutableState = MutableStateFlow(SplashState.Loading)
    val state: StateFlow<SplashState> = mutableState.asStateFlow()

    init {
        viewModelScope.launch {
            mutableState.value = resolveStartupState()
        }
    }

    private suspend fun resolveStartupState(): SplashState {
        if (hasLocalSessionTokenSafely()) {
            return SplashState.Authorized
        }

        return if (checkRemoteSessionSafely()) {
            SplashState.Authorized
        } else {
            SplashState.Unauthorized
        }
    }

    private suspend fun hasLocalSessionTokenSafely(): Boolean {
        return try {
            checkSessionUseCase.hasLocalSessionToken()
        } catch (error: CancellationException) {
            throw error
        } catch (error: Throwable) {
            Log.e(TAG, "Failed to read local session token", error)
            false
        }
    }

    private suspend fun checkRemoteSessionSafely(): Boolean {
        return try {
            checkSessionUseCase().isSuccess
        } catch (error: CancellationException) {
            throw error
        } catch (error: Throwable) {
            Log.e(TAG, "Remote session check failed during splash", error)
            false
        }
    }

    companion object {
        private const val TAG = "SplashViewModel"

        fun factory(useCase: CheckSessionUseCase) = viewModelFactory {
            SplashViewModel(useCase)
        }
    }
}
