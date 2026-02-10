package ru.govchat.app.ui.screens.login

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import ru.govchat.app.core.ui.viewModelFactory
import ru.govchat.app.domain.usecase.LoginUseCase

class LoginViewModel(
    private val loginUseCase: LoginUseCase
) : ViewModel() {

    private val mutableState = MutableStateFlow(LoginUiState())
    val state: StateFlow<LoginUiState> = mutableState.asStateFlow()

    private val mutableEffect = MutableSharedFlow<LoginEffect>(extraBufferCapacity = 1)
    val effect: SharedFlow<LoginEffect> = mutableEffect.asSharedFlow()

    fun updatePhone(value: String) {
        mutableState.value = mutableState.value.copy(
            phone = value,
            errorMessage = null
        )
    }

    fun updatePassword(value: String) {
        mutableState.value = mutableState.value.copy(
            password = value,
            errorMessage = null
        )
    }

    fun submit() {
        val snapshot = mutableState.value
        if (snapshot.phone.isBlank() || snapshot.password.isBlank()) {
            mutableState.value = snapshot.copy(errorMessage = "Enter phone and password")
            return
        }

        viewModelScope.launch {
            mutableState.value = snapshot.copy(isSubmitting = true, errorMessage = null)

            loginUseCase(snapshot.phone, snapshot.password)
                .onSuccess {
                    mutableState.value = mutableState.value.copy(isSubmitting = false)
                    mutableEffect.emit(LoginEffect.NavigateMain)
                }
                .onFailure { error ->
                    mutableState.value = mutableState.value.copy(
                        isSubmitting = false,
                        errorMessage = error.message ?: "Login failed"
                    )
                }
        }
    }

    companion object {
        fun factory(loginUseCase: LoginUseCase) = viewModelFactory {
            LoginViewModel(loginUseCase)
        }
    }
}
