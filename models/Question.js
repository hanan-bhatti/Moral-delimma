const mongoose = require('mongoose');

const choiceSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    trim: true
  },
  votes: {
    type: Number,
    default: 0
  }
});

const responseSchema = new mongoose.Schema({
  choice: {
    type: String,
    required: function () {
      return this.parent().questionType === 'multiple_choice';
    }
  },
  explanation: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  // For paragraph responses, we store the full response text
  responseText: {
    type: String,
    trim: true,
    maxlength: 2000,
    required: function () {
      return this.parent().questionType === 'paragraph';
    }
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  // Keep createdAt for backward compatibility
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const questionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: [
      'love',
      'justice',
      'survival',
      'family',
      'freedom',
      'sacrifice',
      'truth',
      'loyalty',
      'revenge',
      'power',
      'empathy',
      'morality',
      'desire',
      'regret',
      'identity',
      'betrayal',
      'hope',
      'fear',
      'faith',
      'control',
      'loss',
      'trust',
      'responsibility',
      'choice',
      'pain',
      'greed',
      'envy',
      'honor',
      'duty',
      'self'
    ],
    lowercase: true
  },
  questionText: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  questionType: {
    type: String,
    enum: ['multiple_choice', 'paragraph'],
    default: 'multiple_choice',
    required: true
  },
  choices: {
    type: [choiceSchema],
    default: function() {
      return this.questionType === 'multiple_choice' ? [] : undefined;
    },
    validate: {
      validator: function (choices) {
        // For multiple choice questions, require at least 2 choices
        if (this.questionType === 'multiple_choice') {
          return choices && choices.length >= 2 && choices.length <= 6;
        }
        // For paragraph questions, choices should be empty or not exist
        return !choices || choices.length === 0;
      },
      message: 'Multiple choice questions must have 2-6 choices, paragraph questions should have no choices'
    }
  },
  responses: {
    type: [responseSchema],
    default: []
  },
  featured: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Create compound index for category and slug
questionSchema.index({ category: 1, slug: 1 }, { unique: true });

// Index for question types and featured status
questionSchema.index({ questionType: 1 });
questionSchema.index({ featured: 1, createdAt: -1 });
questionSchema.index({ category: 1, questionType: 1 });

// Update the updatedAt field before saving
questionSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

// Virtual for total votes (only applies to multiple choice) - FIXED
questionSchema.virtual('totalVotes').get(function () {
  if (this.questionType === 'multiple_choice') {
    // Add null/undefined check before calling reduce
    if (!this.choices || !Array.isArray(this.choices)) {
      return 0;
    }
    return this.choices.reduce((total, choice) => total + (choice.votes || 0), 0);
  }
  return 0;
});

// Virtual for response count - FIXED
questionSchema.virtual('responseCount').get(function () {
  if (!this.responses || !Array.isArray(this.responses)) {
    return 0;
  }
  return this.responses.length;
});

// Method to add a multiple choice response
questionSchema.methods.addMultipleChoiceResponse = function (choiceText, explanation) {
  if (this.questionType !== 'multiple_choice') {
    throw new Error('Cannot add multiple choice response to paragraph question');
  }

  // Ensure responses array exists
  if (!this.responses) {
    this.responses = [];
  }

  this.responses.push({
    choice: choiceText,
    explanation: explanation,
    timestamp: new Date()
  });

  // Increment vote count for the chosen option
  if (this.choices && Array.isArray(this.choices)) {
    const choice = this.choices.find(c => c.text === choiceText);
    if (choice) {
      choice.votes = (choice.votes || 0) + 1;
    }
  }

  return this.save();
};

// Method to add a paragraph response
questionSchema.methods.addParagraphResponse = function (responseText, explanation = '') {
  if (this.questionType !== 'paragraph') {
    throw new Error('Cannot add paragraph response to multiple choice question');
  }

  // Ensure responses array exists
  if (!this.responses) {
    this.responses = [];
  }

  this.responses.push({
    responseText: responseText,
    explanation: explanation,
    timestamp: new Date()
  });

  return this.save();
};

// Generic method to add response (backward compatible)
questionSchema.methods.addResponse = function (choiceTextOrResponse, explanation = '') {
  if (this.questionType === 'multiple_choice') {
    return this.addMultipleChoiceResponse(choiceTextOrResponse, explanation);
  } else {
    return this.addParagraphResponse(choiceTextOrResponse, explanation);
  }
};

// Static method to find by category and slug
questionSchema.statics.findByCategoryAndSlug = function (category, slug) {
  return this.findOne({ category: category.toLowerCase(), slug: slug.toLowerCase() });
};

// Static method to get featured questions
questionSchema.statics.getFeatured = function (limit = 6) {
  return this.find({ featured: true })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('title slug category questionText questionType createdAt');
};

// Static method to get latest questions
questionSchema.statics.getLatest = function (limit = 10) {
  return this.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('title slug category questionText questionType createdAt featured');
};

// Static method to get questions by type
questionSchema.statics.getByType = function (questionType, limit = 10) {
  return this.find({ questionType })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('title slug category questionText questionType createdAt featured');
};

// Static method to get questions by category and type
questionSchema.statics.getByCategoryAndType = function (category, questionType, limit = 10) {
  return this.find({ category: category.toLowerCase(), questionType })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('title slug category questionText questionType createdAt featured');
};

// Method to get response statistics - FIXED
questionSchema.methods.getResponseStats = function () {
  if (this.questionType === 'multiple_choice') {
    const totalResponses = this.responses ? this.responses.length : 0;
    const choiceStats = (this.choices && Array.isArray(this.choices)) ? 
      this.choices.map(choice => ({
        text: choice.text,
        votes: choice.votes || 0,
        percentage: totalResponses > 0 ? Math.round(((choice.votes || 0) / totalResponses) * 100) : 0
      })) : [];

    return {
      type: 'multiple_choice',
      totalResponses,
      choices: choiceStats
    };
  } else {
    const responses = this.responses && Array.isArray(this.responses) ? this.responses : [];
    return {
      type: 'paragraph',
      totalResponses: responses.length,
      responses: responses.map(response => ({
        responseText: response.responseText,
        explanation: response.explanation,
        timestamp: response.timestamp
      }))
    };
  }
};

// Method to validate question data before saving
questionSchema.methods.validateQuestionData = function () {
  if (this.questionType === 'multiple_choice') {
    if (!this.choices || this.choices.length < 2) {
      throw new Error('Multiple choice questions must have at least 2 choices');
    }
    if (this.choices.length > 6) {
      throw new Error('Multiple choice questions cannot have more than 6 choices');
    }
  } else if (this.questionType === 'paragraph') {
    if (this.choices && this.choices.length > 0) {
      throw new Error('Paragraph questions should not have predefined choices');
    }
  }
  return true;
};

// Pre-save validation
questionSchema.pre('save', function (next) {
  try {
    this.validateQuestionData();
    next();
  } catch (error) {
    next(error);
  }
});

// Transform function to clean up the output - FIXED
questionSchema.methods.toJSON = function () {
  const obj = this.toObject();

  // Add virtual fields with safe access
  try {
    obj.totalVotes = this.totalVotes;
    obj.responseCount = this.responseCount;
  } catch (error) {
    console.warn('Error calculating virtual fields:', error);
    obj.totalVotes = 0;
    obj.responseCount = this.responses ? this.responses.length : 0;
  }

  // For paragraph questions, don't include empty choices array
  if (this.questionType === 'paragraph' && (!obj.choices || obj.choices.length === 0)) {
    delete obj.choices;
  }

  return obj;
};

module.exports = mongoose.model('Question', questionSchema);