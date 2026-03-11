package ru.govchat.app.data.local.callhistory

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
    entities = [CallHistoryEntity::class],
    version = 1,
    exportSchema = false
)
abstract class CallHistoryDatabase : RoomDatabase() {

    abstract fun callHistoryDao(): CallHistoryDao

    companion object {
        @Volatile
        private var instance: CallHistoryDatabase? = null

        fun getInstance(context: Context): CallHistoryDatabase {
            return instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    context.applicationContext,
                    CallHistoryDatabase::class.java,
                    "govchat_call_history.db"
                ).fallbackToDestructiveMigration()
                    .build()
                    .also { instance = it }
            }
        }
    }
}
