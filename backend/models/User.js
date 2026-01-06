const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    unique: true,
    index: true,
    // Формат: +7XXXXXXXXXX или другой международный
    validate: {
      validator: function(v) {
        return /^\+?[1-9]\d{9,14}$/.test(v.replace(/[\s\-()]/g, ''));
      },
      message: 'Некорректный номер телефона'
    }
  },
  phoneNormalized: {
    type: String,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 1,
    maxlength: 100
  },
  passwordHash: {
    type: String,
    required: true
  },
  avatarUrl: {
    type: String,
    default: '/uploads/avatar-default.png'
  },
  // FIX: добавляем профильные поля
  city: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    default: ''
  },
  age: {
    type: Number,
    default: null
  },
  theme: {
    type: Object,
    default: null
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  // FIX: добавляем поле для FCM токена
  fcmToken: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Нормализация номера телефона перед сохранением
userSchema.pre('save', function(next) {
  if (this.isModified('phone')) {
    this.phoneNormalized = this.phone.replace(/[\s\-()]/g, '');
  }
  next();
});

// Метод для публичного JSON
userSchema.methods.toPublicJSON = function() {
  return {
    _id: this._id,
    id: this._id,
    phone: this.phone,
    name: this.name,
    username: this.name, // Для обратной совместимости
    avatarUrl: this.avatarUrl,
    city: this.city,
    status: this.status,
    age: this.age,
    theme: this.theme,
    lastSeen: this.lastSeen,
    createdAt: this.createdAt
  };
};

// Метод для установки пароля
userSchema.methods.setPassword = async function(password) {
  this.passwordHash = await bcrypt.hash(password, 10);
};

// Метод для проверки пароля
userSchema.methods.checkPassword = async function(password) {
  return await bcrypt.compare(password, this.passwordHash);
};

// Индексы
userSchema.index({ phoneNormalized: 1 });
userSchema.index({ status: 1 });

module.exports = mongoose.model('User', userSchema);
