const express = require('express');
const router = express.Router();
const Question = require('../models/Question');
const Joi = require('joi');

// Validation schemas
const responseSchema = Joi.object({
  choice: Joi.string().required(),
  explanation: Joi.string().min(10).max(1000).required()
});

// GET /api/questions - Get latest questions (for homepage)
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 6;
    const featured = req.query.featured === 'true';
    
    let questions;
    if (featured) {
      questions = await Question.getFeatured(limit);
    } else {
      questions = await Question.getLatest(limit);
    }
    
    res.json({
      success: true,
      data: questions,
      count: questions.length
    });
  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch questions'
    });
  }
});

// GET /api/questions/:category/:slug - Get specific question
router.get('/:category/:slug', async (req, res) => {
  try {
    const { category, slug } = req.params;
    
    const question = await Question.findByCategoryAndSlug(category, slug);
    
    if (!question) {
      return res.status(404).json({
        success: false,
        error: 'Question not found'
      });
    }
    
    res.json({
      success: true,
      data: question
    });
  } catch (error) {
    console.error('Error fetching question:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch question'
    });
  }
});

// POST /api/questions/:category/:slug/respond - Add response to question
router.post('/:category/:slug/respond', async (req, res) => {
  try {
    const { category, slug } = req.params;
    
    // Validate request body
    const { error, value } = responseSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }
    
    const { choice, explanation } = value;
    
    const question = await Question.findByCategoryAndSlug(category, slug);
    
    if (!question) {
      return res.status(404).json({
        success: false,
        error: 'Question not found'
      });
    }
    
    // Verify choice exists
    const validChoice = question.choices.find(c => c.text === choice);
    if (!validChoice) {
      return res.status(400).json({
        success: false,
        error: 'Invalid choice'
      });
    }
    
    await question.addResponse(choice, explanation);
    
    res.json({
      success: true,
      message: 'Response added successfully',
      data: {
        totalVotes: question.totalVotes,
        choices: question.choices
      }
    });
  } catch (error) {
    console.error('Error adding response:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add response'
    });
  }
});

// GET /api/questions/:category/:slug/responses - Get responses for a question
router.get('/:category/:slug/responses', async (req, res) => {
  try {
    const { category, slug } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const question = await Question.findByCategoryAndSlug(category, slug);
    
    if (!question) {
      return res.status(404).json({
        success: false,
        error: 'Question not found'
      });
    }
    
    const responses = question.responses
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(skip, skip + limit);
    
    res.json({
      success: true,
      data: {
        responses,
        totalResponses: question.responses.length,
        currentPage: page,
        totalPages: Math.ceil(question.responses.length / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching responses:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch responses'
    });
  }
});

// GET /api/questions/categories - Get all categories with question counts
router.get('/categories', async (req, res) => {
  try {
    const categories = await Question.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          latestQuestion: { $max: '$createdAt' }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);
    
    res.json({
      success: true,
      data: categories.map(cat => ({
        name: cat._id,
        count: cat.count,
        latestQuestion: cat.latestQuestion
      }))
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories'
    });
  }
});

module.exports = router;