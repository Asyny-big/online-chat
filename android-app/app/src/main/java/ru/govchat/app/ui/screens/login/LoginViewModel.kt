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
import ru.govchat.app.domain.usecase.RegisterUseCase

class LoginViewModel(
    private val loginUseCase: LoginUseCase,
    private val registerUseCase: RegisterUseCase
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

    fun updateName(value: String) {
        mutableState.value = mutableState.value.copy(
            name = value,
            errorMessage = null
        )
    }

    fun updatePassword(value: String) {
        mutableState.value = mutableState.value.copy(
            password = value,
            errorMessage = null
        )
    }

    fun switchMode(mode: AuthMode) {
        if (mutableState.value.mode == mode) return
        mutableState.value = mutableState.value.copy(
            mode = mode,
            errorMessage = null
        )
    }

    fun submit() {
        val snapshot = mutableState.value
        val hasRequiredFields = if (snapshot.mode == AuthMode.Login) {
            snapshot.phone.isNotBlank() && snapshot.password.isNotBlank()
        } else {
            snapshot.phone.isNotBlank() && snapshot.password.isNotBlank() && snapshot.name.isNotBlank()
        }

        if (!hasRequiredFields) {
            return
        }

        viewModelScope.launch {
            mutableState.value = snapshot.copy(isSubmitting = true, errorMessage = null)

            val authResult = when (snapshot.mode) {
                AuthMode.Login -> loginUseCase(snapshot.phone, snapshot.password)
                AuthMode.Register -> registerUseCase(snapshot.phone, snapshot.name, snapshot.password)
            }

            authResult
                .onSuccess {
                    mutableState.value = mutableState.value.copy(isSubmitting = false)
                    mutableEffect.emit(LoginEffect.NavigateMain)
                }
                .onFailure { error ->
                    mutableState.value = mutableState.value.copy(
                        isSubmitting = false,
                        errorMessage = error.message ?: "Ошибка авторизации"
                    )
                }
        }
    }

    companion object {
        fun factory(
            loginUseCase: LoginUseCase,
            registerUseCase: RegisterUseCase
        ) = viewModelFactory {
            LoginViewModel(loginUseCase, registerUseCase)
        }
    }
}
