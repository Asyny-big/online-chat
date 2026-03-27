package ru.govchat.app.ui.update

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import ru.govchat.app.core.update.AppUpdateTransferPhase
import ru.govchat.app.core.update.AppUpdateUiState

@Composable
fun AppUpdateDialog(
    state: AppUpdateUiState,
    onStartUpdate: () -> Unit,
    onPostpone: () -> Unit,
    onRetry: () -> Unit
) {
    if (!state.shouldShowModal || state.info == null) return

    Dialog(
        onDismissRequest = {},
        properties = DialogProperties(
            dismissOnBackPress = false,
            dismissOnClickOutside = false
        )
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color(0xAA0A1118)),
            contentAlignment = Alignment.Center
        ) {
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp),
                shape = MaterialTheme.shapes.extraLarge,
                color = Color(0xFF16222D),
                tonalElevation = 0.dp
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState())
                        .padding(20.dp)
                ) {
                    Text(
                        text = if (state.isMandatory) {
                            "Требуется обновление GovChat"
                        } else {
                            "Доступно обновление GovChat"
                        },
                        style = MaterialTheme.typography.headlineSmall,
                        color = Color.White,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    Text(
                        text = "Текущая версия: ${state.currentVersionName}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = Color(0xFF9DB0C3)
                    )
                    Text(
                        text = "Новая версия: ${state.info.latestVersion}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = Color(0xFF9DB0C3)
                    )
                    Spacer(modifier = Modifier.height(14.dp))
                    Text(
                        text = state.statusLabel,
                        style = MaterialTheme.typography.titleMedium,
                        color = Color.White,
                        fontWeight = FontWeight.SemiBold
                    )

                    if (state.info.changelog.isNotEmpty()) {
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = "Что изменилось",
                            style = MaterialTheme.typography.titleSmall,
                            color = Color.White,
                            fontWeight = FontWeight.SemiBold
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        state.info.changelog.forEach { item ->
                            Text(
                                text = "\u2022 $item",
                                style = MaterialTheme.typography.bodyMedium,
                                color = Color(0xFFD4DFEA),
                                modifier = Modifier.padding(bottom = 4.dp)
                            )
                        }
                    }

                    if (state.transferPhase == AppUpdateTransferPhase.Downloading) {
                        Spacer(modifier = Modifier.height(18.dp))
                        if (state.progressPercent != null) {
                            LinearProgressIndicator(
                                progress = { state.progressPercent / 100f },
                                modifier = Modifier.fillMaxWidth(),
                                color = Color(0xFF59B1F8),
                                trackColor = Color(0xFF233343)
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = "${state.progressPercent}% загружено",
                                style = MaterialTheme.typography.bodyMedium,
                                color = Color(0xFF9DB0C3)
                            )
                        } else {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                CircularProgressIndicator(
                                    color = Color(0xFF59B1F8)
                                )
                                Text(
                                    text = "Подготавливаем загрузку…",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = Color(0xFF9DB0C3)
                                )
                            }
                        }
                    }

                    if (state.transferPhase == AppUpdateTransferPhase.Verifying) {
                        Spacer(modifier = Modifier.height(18.dp))
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            CircularProgressIndicator(
                                color = Color(0xFF59B1F8)
                            )
                            Text(
                                text = "Проверяем подпись и целостность APK",
                                style = MaterialTheme.typography.bodyMedium,
                                color = Color(0xFF9DB0C3)
                            )
                        }
                    }

                    if (state.transferPhase == AppUpdateTransferPhase.Installing) {
                        Spacer(modifier = Modifier.height(18.dp))
                        Text(
                            text = "Открываем системную установку. После подтверждения приложение обновится поверх текущей версии.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = Color(0xFF9DB0C3)
                        )
                    }

                    state.errorMessage?.takeIf { it.isNotBlank() }?.let { message ->
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = message,
                            style = MaterialTheme.typography.bodyMedium,
                            color = Color(0xFFFF9E9E)
                        )
                    }

                    if (state.installPermissionRequired) {
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = "Android требует один раз разрешить установку обновлений из GovChat. После возврата загрузка продолжится автоматически.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = Color(0xFF9DB0C3)
                        )
                    }

                    Spacer(modifier = Modifier.height(20.dp))
                    when (state.transferPhase) {
                        AppUpdateTransferPhase.Downloading,
                        AppUpdateTransferPhase.Verifying,
                        AppUpdateTransferPhase.Installing -> {
                            Button(
                                onClick = {},
                                enabled = false,
                                modifier = Modifier.fillMaxWidth(),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = Color(0xFF29567A),
                                    disabledContainerColor = Color(0xFF29567A)
                                )
                            ) {
                                Text("Выполняется…")
                            }
                        }

                        AppUpdateTransferPhase.Error -> {
                            Button(
                                onClick = onRetry,
                                modifier = Modifier.fillMaxWidth(),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = Color(0xFF59B1F8)
                                )
                            ) {
                                Text("Повторить")
                            }
                            if (!state.isMandatory) {
                                TextButton(
                                    onClick = onPostpone,
                                    modifier = Modifier.align(Alignment.End)
                                ) {
                                    Text("Позже")
                                }
                            }
                        }

                        else -> {
                            Button(
                                onClick = onStartUpdate,
                                modifier = Modifier.fillMaxWidth(),
                                enabled = state.canStartUpdate,
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = Color(0xFF59B1F8)
                                )
                            ) {
                                Text(if (state.installPermissionRequired) "Разрешить и обновить" else "Обновить")
                            }
                            if (state.canPostpone) {
                                TextButton(
                                    onClick = onPostpone,
                                    modifier = Modifier.align(Alignment.End)
                                ) {
                                    Text("Позже")
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
