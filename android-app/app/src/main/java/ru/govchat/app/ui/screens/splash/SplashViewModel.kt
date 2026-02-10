package ru.govchat.app.ui.screens.splash

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
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
            val result = checkSessionUseCase()
            mutableState.value = if (result.isSuccess) {
                SplashState.Authorized
            } else {
                SplashState.Unauthorized
            }
        }
    }

    companion object {
        fun factory(useCase: CheckSessionUseCase) = viewModelFactory {
            SplashViewModel(useCase)
        }
    }
}

