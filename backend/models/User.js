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
    default: null
  },
  status: {
    type: String,
    enum: ['online', 'offline'],
    default: 'offline'
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  // Дополнительные поля профиля
  profile: {
    city: { type: String, default: '' },
    about: { type: String, default: '', maxlength: 500 },
    age: { type: Number, min: 0, max: 150 }
  },
  // FCM токены для push-уведомлений (несколько устройств)
  pushTokens: [{
    token: String,
    platform: { type: String, enum: ['android', 'ios', 'web'] },
    createdAt: { type: Date, default: Date.now }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Нормализация номера телефона перед сохранением
userSchema.pre('save', function(next) {
  if (this.isModified('phone')) {
    this.phoneNormalized = this.phone.replace(/[\s\-()]/g, '');
  }
  next();
});

// Хеширование пароля
userSchema.methods.setPassword = async function(password) {
  this.passwordHash = await bcrypt.hash(password, 12);
};

userSchema.methods.checkPassword = async function(password) {
  return bcrypt.compare(password, this.passwordHash);
};

// Публичный профиль (без пароля и приватных данных)
userSchema.methods.toPublicJSON = function() {
  return {
    _id: this._id,
    phone: this.phone,
    name: this.name,
    avatarUrl: this.avatarUrl,
    status: this.status,
    lastSeen: this.lastSeen,
    profile: this.profile
  };
};

// Индексы
userSchema.index({ phoneNormalized: 1 });
userSchema.index({ status: 1 });

module.exports = mongoose.model('User', userSchema);
