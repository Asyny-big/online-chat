const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    unique: true,
    index: true,
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
  fcmToken: {
    type: String,
    default: null
  },
  followers: {
    type: Number,
    default: 0
  },
  following: {
    type: Number,
    default: 0
  },
  friends: {
    type: Number,
    default: 0
  },
  posts: {
    type: Number,
    default: 0
  },
  tokensValidAfter: {
    type: Date,
    default: new Date(0),
    index: true
  }
}, {
  timestamps: true
});

userSchema.pre('save', function(next) {
  if (this.isModified('phone')) {
    this.phoneNormalized = this.phone.replace(/[\s\-()]/g, '');
  }
  next();
});

userSchema.methods.toPublicJSON = function() {
  return {
    _id: this._id,
    id: this._id,
    phone: this.phone,
    name: this.name,
    username: this.name,
    avatarUrl: this.avatarUrl,
    city: this.city,
    status: this.status,
    age: this.age,
    theme: this.theme,
    followers: this.followers || 0,
    following: this.following || 0,
    friends: this.friends || 0,
    posts: this.posts || 0,
    lastSeen: this.lastSeen,
    createdAt: this.createdAt
  };
};

userSchema.methods.setPassword = async function(password) {
  this.passwordHash = await bcrypt.hash(password, 10);
};

userSchema.methods.checkPassword = async function(password) {
  return await bcrypt.compare(password, this.passwordHash);
};

userSchema.index({ status: 1 });

module.exports = mongoose.model('User', userSchema);
