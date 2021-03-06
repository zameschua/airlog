const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const bcrypt = require('bcryptjs');
const Project = require('./Project');
const emailService = require('../utils/emailService');

const UserSchema = new Schema({
  auth: {
    email_address: {
      type: String,
      unique: true,
      required: true,
      trim: true
    },
    password: {
      type: String,
      required: true,
    },
    last_sign_in: {
      type: Date,
      default: Date.now(),
      required: true,
    },
    created: {
      type: Date,
      default: Date.now(),
      required: true,
    }
  },
  services: {
    telegram: {
      username: {
        type: String,
        default: '',
      },
      id: {
        type: String,
        default: ''
      },
    },
    email: {
      email_address: {
        type: String,
        default: '',
      },
    },
  },
  projects: [{
    project_id: mongoose.Schema.Types.ObjectId,
    is_moderator: Boolean,
    _id: false, // Stop mongoose from automatically generating objectId for subdocument
  }],
});

// ------------------ Pre Hook -------------------
// Hash a password before saving it to the database
// TODO: Shift this to app.js
UserSchema.pre('save', function(next) {
  const user = this;

  // Hash the password
  bcrypt.hash(user.auth.password, 10, function (err, hash) {
    if (err) {
      return next(err);
    }
    user.auth.password = hash;
    next();
  });
});

// ---------------------- Methods ------------------------------
UserSchema.methods.verifyPassword = function(password, callback) {
  callback(err, bcrypt.compareSync(password, this.password));
};

UserSchema.methods.getProjects = function() {
  return this.projects.forEach((projectId) => Project.getProjectById(projectId));
}

UserSchema.methods.notify = function(service, notification) {
  if (service === 'telegram') {
    this.sendTelegramNotification(notification);
  } else if (service === 'email') {
    this.sendEmailNotification(notification);
  }
}

UserSchema.methods.sendTelegramNotification = function(notification) {
  const messageToSend = `${new Date(notification.timestamp).toTimeString()}: ${notification.message}`
  const bot = require('../utils/telegramBotService');
  bot.sendMessage(this.services.telegram.id, messageToSend);
}

UserSchema.methods.sendEmailNotification = function(notification) {
  const mailOptions = {
    from: process.env.GMAIL_ADDRESS,
    to: this.services.email.emailAddress,
    subject: "Notification from notification service thingy",
    text: notification.message,
  };
  
  emailService.sendMail(mailOptions, function(error, info){
    if (error) {
      console.error(error);
      return false;
    }
    console.log('Email sent: ' + info.response);
    return true;
  });
}

/**
 * Allow user to update account settings
 * Object should only have 1 key (Might be changed later to support more keys)
 * 
 * {
 *  email_address: newEmailAddress
 * }
 * 
 * @returns updatedUser upon successful update
 */
UserSchema.methods.update = function(updateObject) {
    const key = Object.keys(updateObject)[0];
    const value = updateObject[key];
    this[key] = value;

    this.save(function (err, updatedUser) {
      if (err) return err;
      return updatedUser;
    });
}

const User = mongoose.model('User', UserSchema);
module.exports = User;
