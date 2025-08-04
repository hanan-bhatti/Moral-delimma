// Admin panel functionality - CSP compliant
class AdminPanel {
    constructor() {
        this.loginScreen = document.getElementById('login-screen');
        this.adminPanel = document.getElementById('admin-panel');
        this.currentTab = 'dashboard';
        this.adminSecret = null;
        this.questionsPage = 1;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkAuthStatus();
    }

    setupEventListeners() {
        // Login form
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleLogin();
            });
        }

        // Logout button
        const logoutButton = document.getElementById('logout-button');
        if (logoutButton) {
            logoutButton.addEventListener('click', () => {
                this.logout();
            });
        }

        // Tab switching
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', () => {
                this.switchTab(button.dataset.tab);
            });
        });

        // Create question form
        const createForm = document.getElementById('create-question-form');
        if (createForm) {
            createForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.createQuestion();
            });
        }

        // Question type change handler
        const questionTypeSelect = document.getElementById('question-type');
        if (questionTypeSelect) {
            questionTypeSelect.addEventListener('change', () => {
                this.handleQuestionTypeChange();
            });
        }

        // Add choice button
        const addChoiceButton = document.getElementById('add-choice');
        if (addChoiceButton) {
            addChoiceButton.addEventListener('click', () => {
                this.addChoiceInput();
            });
        }

        // Questions search
        const questionsSearch = document.getElementById('questions-search');
        if (questionsSearch) {
            let searchTimeout;
            questionsSearch.addEventListener('input', () => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.searchQuestions(questionsSearch.value);
                }, 500);
            });
        }

        // Question type filter
        const questionTypeFilter = document.getElementById('question-type-filter');
        if (questionTypeFilter) {
            questionTypeFilter.addEventListener('change', () => {
                this.filterQuestionsByType(questionTypeFilter.value);
            });
        }
    }

    checkAuthStatus() {
        // Use in-memory storage instead of sessionStorage for CSP compliance
        if (this.adminSecret) {
            this.showAdminPanel();
        }
    }

    async handleLogin() {
        const secretInput = document.getElementById('admin-secret');
        const loginError = document.getElementById('login-error');
        const secret = secretInput.value.trim();

        if (!secret) {
            loginError.textContent = 'Please enter the admin secret';
            return;
        }

        try {
            // Test the secret by making a request to the dashboard
            const response = await fetch('/api/admin/dashboard', {
                headers: {
                    'x-admin-secret': secret
                }
            });

            if (response.ok) {
                this.adminSecret = secret;
                // Store in memory instead of sessionStorage
                this.showAdminPanel();
                loginError.textContent = '';
            } else {
                loginError.textContent = 'Invalid admin secret';
                secretInput.value = '';
            }
        } catch (error) {
            console.error('Login error:', error);
            loginError.textContent = 'Connection error. Please try again.';
        }
    }

    logout() {
        this.adminSecret = null;
        this.loginScreen.style.display = 'flex';
        this.adminPanel.style.display = 'none';
        document.getElementById('admin-secret').value = '';
    }

    showAdminPanel() {
        this.loginScreen.style.display = 'none';
        this.adminPanel.style.display = 'block';
        this.loadDashboard();
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-button').forEach(button => {
            button.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');

        this.currentTab = tabName;

        // Load tab-specific data
        switch (tabName) {
            case 'dashboard':
                this.loadDashboard();
                break;
            case 'questions':
                this.loadQuestions();
                break;
            case 'subscribers':
                this.loadSubscriberStats();
                break;
        }
    }

    async loadDashboard() {
        try {
            const response = await fetch('/api/admin/dashboard', {
                headers: {
                    'x-admin-secret': this.adminSecret
                }
            });

            const data = await response.json();

            if (data.success) {
                this.renderDashboard(data.data);
            } else {
                this.showNotification('Failed to load dashboard data', 'error');
            }
        } catch (error) {
            console.error('Error loading dashboard:', error);
            this.showNotification('Error loading dashboard', 'error');
        }
    }

    renderDashboard(data) {
        // Update overview stats with fallback values
        const overview = data.overview || {};
        document.getElementById('total-questions').textContent = overview.totalQuestions || 0;
        document.getElementById('featured-questions').textContent = overview.featuredQuestions || 0;
        document.getElementById('multiple-choice-questions').textContent = overview.multipleChoiceQuestions || 0;
        document.getElementById('paragraph-questions').textContent = overview.paragraphQuestions || 0;
        document.getElementById('total-subscribers').textContent = overview.totalSubscribers || 0;
        document.getElementById('recent-subscribers').textContent = overview.recentSubscribers || 0;

        // Render category stats
        const categoryStatsContainer = document.getElementById('category-stats');
        if (categoryStatsContainer) {
            categoryStatsContainer.innerHTML = '';

            const categoryStats = data.categoryStats || [];
            if (categoryStats.length > 0) {
                categoryStats.forEach(category => {
                    const categoryItem = document.createElement('div');
                    categoryItem.className = 'category-item';
                    
                    const categoryName = document.createElement('div');
                    categoryName.className = 'category-name';
                    categoryName.textContent = category._id || 'Unknown';
                    
                    const categoryCount = document.createElement('div');
                    categoryCount.className = 'category-count';
                    categoryCount.textContent = `${category.count || 0} questions`;
                    
                    categoryItem.appendChild(categoryName);
                    categoryItem.appendChild(categoryCount);
                    categoryStatsContainer.appendChild(categoryItem);
                });
            } else {
                const noData = document.createElement('div');
                noData.className = 'no-data';
                noData.textContent = 'No category data available';
                categoryStatsContainer.appendChild(noData);
            }
        }

        // Render question type stats
        const questionTypeStatsContainer = document.getElementById('question-type-stats');
        if (questionTypeStatsContainer) {
            questionTypeStatsContainer.innerHTML = '';

            const questionTypeStats = data.questionTypeStats || [];
            if (questionTypeStats.length > 0) {
                questionTypeStats.forEach(typeStats => {
                    const typeItem = document.createElement('div');
                    typeItem.className = 'type-item';
                    
                    const typeName = typeStats._id === 'multiple_choice' ? 'Multiple Choice' : 
                                   typeStats._id === 'paragraph' ? 'Paragraph' : 
                                   typeStats._id || 'Unknown';
                    
                    const typeNameDiv = document.createElement('div');
                    typeNameDiv.className = 'type-name';
                    typeNameDiv.textContent = typeName;
                    
                    const typeCountDiv = document.createElement('div');
                    typeCountDiv.className = 'type-count';
                    typeCountDiv.textContent = `${typeStats.count || 0} questions`;
                    
                    typeItem.appendChild(typeNameDiv);
                    typeItem.appendChild(typeCountDiv);
                    questionTypeStatsContainer.appendChild(typeItem);
                });
            } else {
                const noData = document.createElement('div');
                noData.className = 'no-data';
                noData.textContent = 'No question type data available';
                questionTypeStatsContainer.appendChild(noData);
            }
        }

        // Render recent questions
        const recentQuestionsContainer = document.getElementById('recent-questions');
        if (recentQuestionsContainer) {
            recentQuestionsContainer.innerHTML = '';

            const recentQuestions = data.recentQuestions || [];
            if (recentQuestions.length > 0) {
                recentQuestions.forEach(question => {
                    const questionItem = document.createElement('div');
                    questionItem.className = 'recent-question-item';
                    
                    const questionType = question.questionType === 'paragraph' ? 'Paragraph' : 'Multiple Choice';
                    
                    const titleDiv = document.createElement('div');
                    titleDiv.className = 'recent-question-title';
                    titleDiv.textContent = question.title || 'Untitled';
                    
                    const metaDiv = document.createElement('div');
                    metaDiv.className = 'recent-question-meta';
                    metaDiv.textContent = `${question.category || 'Unknown'} • ${questionType} • ${question.responseCount || 0} responses • ${this.formatDate(new Date(question.createdAt))}`;
                    
                    questionItem.appendChild(titleDiv);
                    questionItem.appendChild(metaDiv);
                    recentQuestionsContainer.appendChild(questionItem);
                });
            } else {
                const noData = document.createElement('div');
                noData.className = 'no-data';
                noData.textContent = 'No recent questions';
                recentQuestionsContainer.appendChild(noData);
            }
        }
    }

    handleQuestionTypeChange() {
        const questionType = document.getElementById('question-type').value;
        const choicesSection = document.getElementById('choices-section');
        const paragraphSection = document.getElementById('paragraph-section');

        if (questionType === 'multiple_choice') {
            choicesSection.style.display = 'block';
            paragraphSection.style.display = 'none';
        } else if (questionType === 'paragraph') {
            choicesSection.style.display = 'none';
            paragraphSection.style.display = 'block';
        } else {
            choicesSection.style.display = 'none';
            paragraphSection.style.display = 'none';
        }
    }

    async loadQuestions(page = 1) {
        try {
            const response = await fetch(`/api/admin/questions?page=${page}&limit=10`, {
                headers: {
                    'x-admin-secret': this.adminSecret
                }
            });

            const data = await response.json();

            if (data.success) {
                this.renderQuestions(data.data.questions);
                this.renderPagination(data.data.pagination);
                this.questionsPage = page;
            } else {
                this.showNotification('Failed to load questions', 'error');
            }
        } catch (error) {
            console.error('Error loading questions:', error);
            this.showNotification('Error loading questions', 'error');
        }
    }

    async filterQuestionsByType(type) {
        try {
            let url = '/api/admin/questions?page=1&limit=10';
            if (type) {
                url += `&type=${type}`;
            }

            const response = await fetch(url, {
                headers: {
                    'x-admin-secret': this.adminSecret
                }
            });

            const data = await response.json();

            if (data.success) {
                this.renderQuestions(data.data.questions);
                this.renderPagination(data.data.pagination);
                this.questionsPage = 1;
            } else {
                this.showNotification('Failed to filter questions', 'error');
            }
        } catch (error) {
            console.error('Error filtering questions:', error);
            this.showNotification('Error filtering questions', 'error');
        }
    }

    renderQuestions(questions) {
        const questionsList = document.getElementById('questions-list');
        questionsList.innerHTML = '';

        questions.forEach(question => {
            const questionItem = document.createElement('div');
            questionItem.className = 'question-item';
            
            // Create question info section
            const questionInfo = document.createElement('div');
            questionInfo.className = 'question-info';
            
            const titleDiv = document.createElement('div');
            titleDiv.className = 'question-item-title';
            titleDiv.textContent = question.title;
            
            const metaDiv = document.createElement('div');
            metaDiv.className = 'question-item-meta';
            
            const questionType = question.questionType === 'paragraph' ? 'Paragraph' : 'Multiple Choice';
            
            // Create individual meta spans
            const categorySpan = document.createElement('span');
            categorySpan.textContent = question.category;
            
            const typeSpan = document.createElement('span');
            typeSpan.textContent = questionType;
            
            const responseSpan = document.createElement('span');
            responseSpan.textContent = `${question.responseCount} responses`;
            
            const dateSpan = document.createElement('span');
            dateSpan.textContent = this.formatDate(new Date(question.createdAt));
            
            metaDiv.appendChild(categorySpan);
            metaDiv.appendChild(typeSpan);
            metaDiv.appendChild(responseSpan);
            metaDiv.appendChild(dateSpan);
            
            if (question.featured) {
                const featuredBadge = document.createElement('span');
                featuredBadge.className = 'featured-badge';
                featuredBadge.textContent = 'Featured';
                metaDiv.appendChild(featuredBadge);
            }
            
            questionInfo.appendChild(titleDiv);
            questionInfo.appendChild(metaDiv);
            
            // Create question actions section
            const questionActions = document.createElement('div');
            questionActions.className = 'question-actions';
            
            // Feature/Unfeature button
            const featureButton = document.createElement('button');
            featureButton.className = `action-button ${question.featured ? 'featured' : ''}`;
            featureButton.textContent = question.featured ? 'Unfeature' : 'Feature';
            featureButton.addEventListener('click', () => {
                this.toggleFeatured(question._id, !question.featured);
            });
            
            // View button
            const viewButton = document.createElement('button');
            viewButton.className = 'action-button';
            viewButton.textContent = 'View';
            viewButton.addEventListener('click', () => {
                window.open(question.url, '_blank');
            });
            
            // Delete button
            const deleteButton = document.createElement('button');
            deleteButton.className = 'action-button delete';
            deleteButton.textContent = 'Delete';
            deleteButton.addEventListener('click', () => {
                this.deleteQuestion(question._id);
            });
            
            questionActions.appendChild(featureButton);
            questionActions.appendChild(viewButton);
            questionActions.appendChild(deleteButton);
            
            questionItem.appendChild(questionInfo);
            questionItem.appendChild(questionActions);
            questionsList.appendChild(questionItem);
        });
    }

    renderPagination(pagination) {
        const paginationContainer = document.getElementById('questions-pagination');
        paginationContainer.innerHTML = '';

        // Previous button
        const prevButton = document.createElement('button');
        prevButton.className = 'page-button';
        prevButton.textContent = '← Previous';
        prevButton.disabled = !pagination.hasPrev;
        prevButton.addEventListener('click', () => this.loadQuestions(pagination.currentPage - 1));
        paginationContainer.appendChild(prevButton);

        // Page info
        const pageInfo = document.createElement('span');
        pageInfo.textContent = `Page ${pagination.currentPage} of ${pagination.totalPages}`;
        pageInfo.style.padding = '0.5rem 1rem';
        pageInfo.style.color = 'var(--text-secondary)';
        paginationContainer.appendChild(pageInfo);

        // Next button
        const nextButton = document.createElement('button');
        nextButton.className = 'page-button';
        nextButton.textContent = 'Next →';
        nextButton.disabled = !pagination.hasNext;
        nextButton.addEventListener('click', () => this.loadQuestions(pagination.currentPage + 1));
        paginationContainer.appendChild(nextButton);
    }

    async createQuestion() {
        const form = document.getElementById('create-question-form');
        const submitButton = form.querySelector('button[type="submit"]');
        const buttonText = submitButton.querySelector('.button-text');
        const buttonLoading = submitButton.querySelector('.button-loading');

        // Get form data
        const title = document.getElementById('question-title').value.trim();
        const category = document.getElementById('question-category').value;
        const questionType = document.getElementById('question-type').value;
        const questionText = document.getElementById('question-text').value.trim();
        const featured = document.getElementById('question-featured').checked;

        // Validation
        if (!title || !category || !questionType || !questionText) {
            this.showNotification('Please fill in all required fields', 'error');
            return;
        }

        // Prepare request data
        const requestData = {
            title,
            category,
            questionType,
            questionText,
            featured,
            adminSecret: this.adminSecret
        };

        // Add choices only for multiple choice questions
        if (questionType === 'multiple_choice') {
            const choiceInputs = document.querySelectorAll('#choices-container input[type="text"]');
            const choices = Array.from(choiceInputs)
                .map(input => ({ text: input.value.trim() }))
                .filter(choice => choice.text.length > 0);

            if (choices.length < 2) {
                this.showNotification('Please provide at least 2 choices for multiple choice questions', 'error');
                return;
            }

            requestData.choices = choices;
        }

        // Show loading state
        submitButton.disabled = true;
        buttonText.style.display = 'none';
        buttonLoading.style.display = 'flex';

        try {
            const response = await fetch('/api/admin/questions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-secret': this.adminSecret
                },
                body: JSON.stringify(requestData)
            });

            const data = await response.json();

            if (data.success) {
                this.showNotification('Question created successfully!', 'success');
                form.reset();
                this.resetChoices();
                this.handleQuestionTypeChange(); // Reset form sections
                
                // Switch to questions tab to see the new question
                setTimeout(() => {
                    this.switchTab('questions');
                }, 1000);
            } else {
                this.showNotification(data.error || 'Failed to create question', 'error');
            }
        } catch (error) {
            console.error('Error creating question:', error);
            this.showNotification('Network error. Please try again.', 'error');
        } finally {
            // Hide loading state
            submitButton.disabled = false;
            buttonText.style.display = 'inline';
            buttonLoading.style.display = 'none';
        }
    }

    addChoiceInput() {
        const choicesContainer = document.getElementById('choices-container');
        const choiceInputs = choicesContainer.querySelectorAll('.choice-input');
        
        if (choiceInputs.length >= 6) {
            this.showNotification('Maximum 6 choices allowed', 'warning');
            return;
        }

        const choiceInput = document.createElement('div');
        choiceInput.className = 'choice-input';
        
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = `Choice ${choiceInputs.length + 1}`;
        input.required = true;
        input.maxLength = 500;
        
        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'remove-choice';
        removeButton.textContent = '×';
        removeButton.addEventListener('click', () => {
            choiceInput.remove();
            this.updateRemoveButtons();
        });

        choiceInput.appendChild(input);
        choiceInput.appendChild(removeButton);
        choicesContainer.appendChild(choiceInput);
        this.updateRemoveButtons();
    }

    updateRemoveButtons() {
        const choiceInputs = document.querySelectorAll('#choices-container .choice-input');
        choiceInputs.forEach((input) => {
            const removeButton = input.querySelector('.remove-choice');
            if (choiceInputs.length > 2) {
                removeButton.style.display = 'flex';
            } else {
                removeButton.style.display = 'none';
            }
        });
    }

    resetChoices() {
        const choicesContainer = document.getElementById('choices-container');
        choicesContainer.innerHTML = '';
        
        // Create two default choice inputs
        for (let i = 1; i <= 2; i++) {
            const choiceInput = document.createElement('div');
            choiceInput.className = 'choice-input';
            
            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = `Choice ${i}`;
            input.required = true;
            input.maxLength = 500;
            
            const removeButton = document.createElement('button');
            removeButton.type = 'button';
            removeButton.className = 'remove-choice';
            removeButton.textContent = '×';
            removeButton.style.display = 'none';
            removeButton.addEventListener('click', () => {
                choiceInput.remove();
                this.updateRemoveButtons();
            });
            
            choiceInput.appendChild(input);
            choiceInput.appendChild(removeButton);
            choicesContainer.appendChild(choiceInput);
        }
    }

    async toggleFeatured(questionId, featured) {
        try {
            const response = await fetch(`/api/admin/questions/${questionId}/featured`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-secret': this.adminSecret
                },
                body: JSON.stringify({ featured })
            });

            const data = await response.json();

            if (data.success) {
                this.showNotification(`Question ${featured ? 'featured' : 'unfeatured'} successfully`, 'success');
                this.loadQuestions(this.questionsPage);
            } else {
                this.showNotification(data.error || 'Failed to update question', 'error');
            }
        } catch (error) {
            console.error('Error toggling featured status:', error);
            this.showNotification('Error updating question', 'error');
        }
    }

    async deleteQuestion(questionId) {
        if (!confirm('Are you sure you want to delete this question? This action cannot be undone.')) {
            return;
        }

        try {
            const response = await fetch(`/api/admin/questions/${questionId}`, {
                method: 'DELETE',
                headers: {
                    'x-admin-secret': this.adminSecret
                }
            });

            const data = await response.json();

            if (data.success) {
                this.showNotification('Question deleted successfully', 'success');
                this.loadQuestions(this.questionsPage);
            } else {
                this.showNotification(data.error || 'Failed to delete question', 'error');
            }
        } catch (error) {
            console.error('Error deleting question:', error);
            this.showNotification('Error deleting question', 'error');
        }
    }

    async searchQuestions(searchTerm) {
        if (!searchTerm.trim()) {
            this.loadQuestions(1);
            return;
        }

        try {
            const response = await fetch(`/api/admin/questions/search?q=${encodeURIComponent(searchTerm)}`, {
                headers: {
                    'x-admin-secret': this.adminSecret
                }
            });

            const data = await response.json();

            if (data.success) {
                this.renderQuestions(data.data.questions);
                // Hide pagination for search results
                const paginationContainer = document.getElementById('questions-pagination');
                paginationContainer.innerHTML = '';
                const resultCount = document.createElement('span');
                resultCount.style.padding = '0.5rem';
                resultCount.style.color = 'var(--text-secondary)';
                resultCount.textContent = `Found ${data.data.total} questions`;
                paginationContainer.appendChild(resultCount);
            } else {
                this.showNotification('Search failed', 'error');
            }
        } catch (error) {
            console.error('Error searching questions:', error);
            this.showNotification('Search error', 'error');
        }
    }

    async loadSubscriberStats() {
        try {
            const response = await fetch('/api/admin/subscribers', {
                headers: {
                    'x-admin-secret': this.adminSecret
                }
            });

            const data = await response.json();

            if (data.success) {
                this.renderSubscriberStats(data.data);
            } else {
                this.showNotification('Failed to load subscriber stats', 'error');
            }
        } catch (error) {
            console.error('Error loading subscriber stats:', error);
            this.showNotification('Error loading subscriber stats', 'error');
        }
    }

    renderSubscriberStats(data) {
        // Update subscriber stats
        document.getElementById('sub-total').textContent = data.stats.total;
        document.getElementById('sub-active').textContent = data.stats.active;
        document.getElementById('sub-inactive').textContent = data.stats.inactive;
        document.getElementById('sub-recent').textContent = data.stats.recentSubscribers7;

        // Render subscribers list
        const subscribersList = document.getElementById('subscribers-list');
        subscribersList.innerHTML = '';

        data.subscribers.forEach(subscriber => {
            const subscriberItem = document.createElement('div');
            subscriberItem.className = 'subscriber-item';
            
            // Create subscriber info section
            const subscriberInfo = document.createElement('div');
            subscriberInfo.className = 'subscriber-info';
            
            const emailDiv = document.createElement('div');
            emailDiv.className = 'subscriber-email';
            emailDiv.textContent = subscriber.email;
            
            const metaDiv = document.createElement('div');
            metaDiv.className = 'subscriber-meta';
            metaDiv.textContent = `Subscribed: ${this.formatDate(new Date(subscriber.subscribedAt))}`;
            
            const statusSpan = document.createElement('span');
            statusSpan.className = subscriber.isActive ? 'status-active' : 'status-inactive';
            statusSpan.textContent = subscriber.isActive ? 'Active' : 'Inactive';
            metaDiv.appendChild(document.createTextNode(' '));
            metaDiv.appendChild(statusSpan);
            
            subscriberInfo.appendChild(emailDiv);
            subscriberInfo.appendChild(metaDiv);
            
            // Create subscriber actions section
            const subscriberActions = document.createElement('div');
            subscriberActions.className = 'subscriber-actions';
            
            const toggleButton = document.createElement('button');
            toggleButton.className = 'action-button';
            toggleButton.textContent = subscriber.isActive ? 'Deactivate' : 'Activate';
            toggleButton.addEventListener('click', () => {
                this.toggleSubscriberStatus(subscriber._id, !subscriber.isActive);
            });
            
            subscriberActions.appendChild(toggleButton);
            
            subscriberItem.appendChild(subscriberInfo);
            subscriberItem.appendChild(subscriberActions);
            subscribersList.appendChild(subscriberItem);
        });

        // Render pagination if provided
        if (data.pagination) {
            this.renderSubscriberPagination(data.pagination);
        }
    }

    renderSubscriberPagination(pagination) {
        const paginationContainer = document.getElementById('subscribers-pagination');
        if (!paginationContainer) return;
        
        paginationContainer.innerHTML = '';

        // Previous button
        const prevButton = document.createElement('button');
        prevButton.className = 'page-button';
        prevButton.textContent = '← Previous';
        prevButton.disabled = !pagination.hasPrev;
        prevButton.addEventListener('click', () => this.loadSubscriberStats(pagination.currentPage - 1));
        paginationContainer.appendChild(prevButton);

        // Page info
        const pageInfo = document.createElement('span');
        pageInfo.textContent = `Page ${pagination.currentPage} of ${pagination.totalPages}`;
        pageInfo.style.padding = '0.5rem 1rem';
        pageInfo.style.color = 'var(--text-secondary)';
        paginationContainer.appendChild(pageInfo);

        // Next button
        const nextButton = document.createElement('button');
        nextButton.className = 'page-button';
        nextButton.textContent = 'Next →';
        nextButton.disabled = !pagination.hasNext;
        nextButton.addEventListener('click', () => this.loadSubscriberStats(pagination.currentPage + 1));
        paginationContainer.appendChild(nextButton);
    }

    async toggleSubscriberStatus(subscriberId, isActive) {
        try {
            const response = await fetch(`/api/admin/subscribers/${subscriberId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-secret': this.adminSecret
                },
                body: JSON.stringify({ isActive })
            });

            const data = await response.json();

            if (data.success) {
                this.showNotification(`Subscriber ${isActive ? 'activated' : 'deactivated'} successfully`, 'success');
                this.loadSubscriberStats();
            } else {
                this.showNotification(data.error || 'Failed to update subscriber status', 'error');
            }
        } catch (error) {
            console.error('Error toggling subscriber status:', error);
            this.showNotification('Error updating subscriber status', 'error');
        }
    }

    showNotification(message, type = 'info') {
        // Remove existing notifications
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(notification => notification.remove());

        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        
        const messageSpan = document.createElement('span');
        messageSpan.textContent = message;
        
        const closeButton = document.createElement('button');
        closeButton.className = 'notification-close';
        closeButton.textContent = '×';
        closeButton.addEventListener('click', () => {
            notification.remove();
        });
        
        notification.appendChild(messageSpan);
        notification.appendChild(closeButton);

        // Add to document
        document.body.appendChild(notification);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);

        // Trigger animation
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatDate(date) {
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

// Initialize admin panel when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.adminPanel = new AdminPanel();
});