const nodemailer = require('nodemailer');
const Subscriber = require('../models/Subscriber');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  initializeTransporter() {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.warn('Email credentials not configured. Email functionality will be disabled.');
      return;
    }

    this.transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }

  async verifyConnection() {
    if (!this.transporter) {
      throw new Error('Email transporter not configured');
    }

    try {
      await this.transporter.verify();
      console.log('Email service connected successfully');
      return true;
    } catch (error) {
      console.error('Email service connection failed:', error);
      throw error;
    }
  }

  generateNewQuestionEmail(question) {
    const questionUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/${question.category}/${question.slug}`;
    const choicesText = question.choices.map((choice, index) => `${index + 1}. ${choice.text}`).join('\n');

    return {
      subject: `New Moral Dilemma: ${question.title}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Moral Dilemma</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
            .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
            .content { padding: 30px; }
            .question-text { background-color: #f8f9fa; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0; font-style: italic; }
            .choices { margin: 20px 0; }
            .choice { background-color: #f8f9fa; padding: 10px; margin: 10px 0; border-radius: 5px; }
            .cta-button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 5px; margin: 20px 0; }
            .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
            .unsubscribe { color: #999; text-decoration: none; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🤔 New Moral Dilemma</h1>
              <p>A thought-provoking question awaits your consideration</p>
            </div>
            
            <div class="content">
              <h2>${question.title}</h2>
              <p><strong>Category:</strong> ${question.category.charAt(0).toUpperCase() + question.category.slice(1)}</p>
              
              <div class="question-text">
                ${question.questionText}
              </div>
              
              <h3>Your choices:</h3>
              <div class="choices">
                ${question.choices.map((choice, index) => 
                  `<div class="choice">${index + 1}. ${choice.text}</div>`
                ).join('')}
              </div>
              
              <div style="text-align: center;">
                <a href="${questionUrl}" class="cta-button">
                  Share Your Perspective →
                </a>
              </div>
              
              <p>What would you choose? Click the link above to cast your vote and share your reasoning with the community.</p>
            </div>
            
            <div class="footer">
              <p>You're receiving this because you subscribed to our moral dilemma newsletter.</p>
              <p><a href="{{unsubscribe_url}}" class="unsubscribe">Unsubscribe</a></p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
New Moral Dilemma: ${question.title}

Category: ${question.category.charAt(0).toUpperCase() + question.category.slice(1)}

${question.questionText}

Your choices:
${choicesText}

What would you choose? Visit ${questionUrl} to share your perspective.

---
You're receiving this because you subscribed to our moral dilemma newsletter.
To unsubscribe, visit: {{unsubscribe_url}}
      `
    };
  }

  async notifySubscribers(question) {
    if (!this.transporter) {
      console.warn('Email transporter not configured. Skipping notification.');
      return;
    }

    try {
      const subscribers = await Subscriber.findActive();
      
      if (subscribers.length === 0) {
        console.log('No active subscribers to notify');
        return;
      }

      const emailTemplate = this.generateNewQuestionEmail(question);
      const results = [];

      // Send emails in batches to avoid overwhelming the email service
      const batchSize = 50;
      for (let i = 0; i < subscribers.length; i += batchSize) {
        const batch = subscribers.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (subscriber) => {
          try {
            const unsubscribeUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/api/subscribers/unsubscribe/${subscriber.unsubscribeToken}`;
            
            const personalizedHtml = emailTemplate.html.replace('{{unsubscribe_url}}', unsubscribeUrl);
            const personalizedText = emailTemplate.text.replace('{{unsubscribe_url}}', unsubscribeUrl);

            await this.transporter.sendMail({
              from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
              to: subscriber.email,
              subject: emailTemplate.subject,
              html: personalizedHtml,
              text: personalizedText
            });

            // Update last notified timestamp
            await subscriber.updateLastNotified();
            
            return { email: subscriber.email, status: 'sent' };
          } catch (error) {
            console.error(`Failed to send email to ${subscriber.email}:`, error);
            return { email: subscriber.email, status: 'failed', error: error.message };
          }
        });

        const batchResults = await Promise.allSettled(batchPromises);
        results.push(...batchResults.map(result => result.value || result.reason));

        // Add delay between batches to respect rate limits
        if (i + batchSize < subscribers.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      const successful = results.filter(r => r.status === 'sent').length;
      const failed = results.filter(r => r.status === 'failed').length;

      console.log(`Email notification complete: ${successful} sent, ${failed} failed`);
      
      return {
        total: subscribers.length,
        successful,
        failed,
        results
      };
    } catch (error) {
      console.error('Error sending notification emails:', error);
      throw error;
    }
  }

  async sendWelcomeEmail(subscriberEmail) {
    if (!this.transporter) {
      console.warn('Email transporter not configured. Skipping welcome email.');
      return;
    }

    try {
      const subscriber = await Subscriber.findOne({ email: subscriberEmail });
      if (!subscriber) {
        throw new Error('Subscriber not found');
      }

      const unsubscribeUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/api/subscribers/unsubscribe/${subscriber.unsubscribeToken}`;

      await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to: subscriberEmail,
        subject: 'Welcome to Moral Dilemmas - Explore the Gray Areas',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Welcome to Moral Dilemmas</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
              .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
              .content { padding: 30px; }
              .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
              .unsubscribe { color: #999; text-decoration: none; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🎭 Welcome to Moral Dilemmas</h1>
                <p>Where ethics meet curiosity</p>
              </div>
              
              <div class="content">
                <h2>Thank you for subscribing!</h2>
                <p>You've joined a community of thoughtful individuals who aren't afraid to wrestle with life's most challenging questions.</p>
                
                <p>Here's what you can expect:</p>
                <ul>
                  <li><strong>📧 Weekly dilemmas</strong> delivered to your inbox</li>
                  <li><strong>🤝 Community insights</strong> on how others approach tough choices</li>
                  <li><strong>🧠 Thought-provoking scenarios</strong> across love, justice, family, and more</li>
                  <li><strong>💭 Safe space</strong> to explore complex moral questions</li>
                </ul>
                
                <p>Every dilemma is designed to challenge your thinking and help you understand different perspectives. There are no right or wrong answers—only honest reflection and meaningful dialogue.</p>
                
                <p>Ready to dive in? Visit our website to explore current dilemmas and share your thoughts with the community.</p>
              </div>
              
              <div class="footer">
                <p>You can <a href="${unsubscribeUrl}" class="unsubscribe">unsubscribe</a> at any time.</p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `
Welcome to Moral Dilemmas!

Thank you for subscribing to our community of thoughtful individuals who explore life's challenging questions.

Here's what you can expect:
- Weekly dilemmas delivered to your inbox
- Community insights on how others approach tough choices  
- Thought-provoking scenarios across love, justice, family, and more
- A safe space to explore complex moral questions

Every dilemma is designed to challenge your thinking and help you understand different perspectives. There are no right or wrong answers—only honest reflection and meaningful dialogue.

Ready to dive in? Visit our website to explore current dilemmas and share your thoughts.

You can unsubscribe at any time: ${unsubscribeUrl}
        `
      });

      console.log(`Welcome email sent to ${subscriberEmail}`);
    } catch (error) {
      console.error(`Failed to send welcome email to ${subscriberEmail}:`, error);
      throw error;
    }
  }
}

module.exports = new EmailService();