package ru.govchat.app.ui.screens.login

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp

@Composable
fun LoginScreen(
    state: LoginUiState,
    onModeChanged: (AuthMode) -> Unit,
    onPhoneChanged: (String) -> Unit,
    onNameChanged: (String) -> Unit,
    onPasswordChanged: (String) -> Unit,
    onLoginClick: () -> Unit
) {
    val isLoginMode = state.mode == AuthMode.Login
    val canSubmit = if (isLoginMode) {
        state.phone.isNotBlank() && state.password.isNotBlank()
    } else {
        state.phone.isNotBlank() && state.name.isNotBlank() && state.password.isNotBlank()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(
                color = Color(0xFF0F172A)
            )
            .padding(horizontal = 20.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Surface(
            shape = RoundedCornerShape(20.dp),
            color = Color(0xFF1E293B),
            tonalElevation = 4.dp,
            modifier = Modifier
                .fillMaxWidth()
                .border(
                    width = 1.dp,
                    color = Color(0xFF334155),
                    shape = RoundedCornerShape(20.dp)
                )
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    text = "\uD83E\uDD86 GovChat",
                    style = MaterialTheme.typography.headlineSmall,
                    color = Color.White
                )

                Text(
                    text = "Современный мессенджер",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color(0xFF64748B)
                )

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFF0F172A), RoundedCornerShape(12.dp))
                        .padding(4.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    AuthTab(
                        text = "Вход",
                        isActive = isLoginMode,
                        onClick = { onModeChanged(AuthMode.Login) },
                        modifier = Modifier.weight(1f)
                    )
                    AuthTab(
                        text = "Регистрация",
                        isActive = !isLoginMode,
                        onClick = { onModeChanged(AuthMode.Register) },
                        modifier = Modifier.weight(1f)
                    )
                }

                if (!isLoginMode) {
                    OutlinedTextField(
                        value = state.name,
                        onValueChange = onNameChanged,
                        label = { Text("Ваше имя") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }

                OutlinedTextField(
                    value = state.phone,
                    onValueChange = onPhoneChanged,
                    label = { Text("Номер телефона") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = state.password,
                    onValueChange = onPasswordChanged,
                    label = { Text("Пароль") },
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation(),
                    modifier = Modifier.fillMaxWidth()
                )

                if (state.errorMessage != null) {
                    Text(
                        text = state.errorMessage,
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFFEF4444)
                    )
                }

                Spacer(modifier = Modifier.height(4.dp))

                Button(
                    onClick = onLoginClick,
                    enabled = !state.isSubmitting && canSubmit,
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFF3B82F6),
                        disabledContainerColor = Color(0xFF334155),
                        disabledContentColor = Color(0xFF94A3B8)
                    ),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = when {
                            state.isSubmitting -> "Загрузка..."
                            isLoginMode -> "Войти"
                            else -> "Зарегистрироваться"
                        },
                        style = MaterialTheme.typography.labelLarge
                    )
                }
            }
        }
    }
}

@Composable
private fun AuthTab(
    text: String,
    isActive: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val active = Color(0xFF3B82F6)
    val inactive = Color.Transparent
    val content = if (isActive) Color.White else Color(0xFF94A3B8)

    Button(
        onClick = onClick,
        modifier = modifier,
        shape = RoundedCornerShape(8.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = if (isActive) active else inactive,
            contentColor = content,
            disabledContainerColor = inactive,
            disabledContentColor = content
        ),
        elevation = null
    ) {
        Text(text = text)
    }
}
