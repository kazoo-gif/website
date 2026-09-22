// ===== CONFIGURATION =====
// 🔧 REPLACE THESE WITH YOUR SUPABASE VALUES!
const SUPABASE_URL = 'https://bmpppymxjkgbfupxwpsw.supabase.co';  // Like: https://xxxxx.supabase.co
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtcHBweW14amtnYmZ1cHh3cHN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNDgxMzgsImV4cCI6MjA4MzkyNDEzOH0.kqf6VqUEvs8DnuG2S3FFxr7JxecngbXextYeV3rCENI';      // Your anon/public key

// Initialize Supabase
let supabaseClient;
let currentUser = null;
let selectedImageFile = null;

// ===== AUTH FUNCTIONS =====
async function checkAuth() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    currentUser = user;
    updateAuthUI();
    return user;
}

function updateAuthUI() {
    const loginForm = document.getElementById('loginForm');
    const postForm = document.getElementById('postFormContainer');
    const statusText = document.getElementById('statusText');

    if (currentUser) {
        if (loginForm) loginForm.classList.add('hidden');
        if (postForm) postForm.classList.remove('hidden');
        if (statusText) statusText.textContent = '✓ Logged in as Admin';
    } else {
        if (loginForm) loginForm.classList.remove('hidden');
        if (postForm) postForm.classList.add('hidden');
        if (statusText) statusText.textContent = 'Visitor Mode';
    }
}

async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) throw error;

        currentUser = data.user;
        updateAuthUI();
        showNotification('Logged in successfully! ✨');
        
        document.getElementById('loginEmail').value = '';
        document.getElementById('loginPassword').value = '';
    } catch (error) {
        showNotification('Login failed: ' + error.message, true);
    }
}

async function handleLogout() {
    try {
        await supabaseClient.auth.signOut();
        currentUser = null;
        updateAuthUI();
        showNotification('Logged out successfully');
    } catch (error) {
        showNotification('Logout failed: ' + error.message, true);
    }
}

// ===== IMAGE FUNCTIONS =====
function previewImage(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
        showNotification('Image must be less than 5MB', true);
        event.target.value = '';
        return;
    }

    if (!file.type.startsWith('image/')) {
        showNotification('Please select an image file', true);
        event.target.value = '';
        return;
    }

    selectedImageFile = file;

    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('previewImg').src = e.target.result;
        document.getElementById('imagePreview').classList.remove('hidden');
    };
    reader.readAsDataURL(file);
}

function removeImage() {
    selectedImageFile = null;
    document.getElementById('postImage').value = '';
    document.getElementById('imagePreview').classList.add('hidden');
    document.getElementById('previewImg').src = '';
}

async function uploadImage(file) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${fileName}`;

    const { data, error } = await supabaseClient.storage
        .from('blog-images')
        .upload(filePath, file);

    if (error) throw error;

    const { data: urlData } = supabaseClient.storage
        .from('blog-images')
        .getPublicUrl(filePath);

    return urlData.publicUrl;
}

// ===== POST FUNCTIONS =====
async function loadPosts() {
    try {
        const { data, error } = await supabaseClient
            .from('posts')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        updateStats(data.length);
        renderRecentPosts(data);
        return data;
    } catch (error) {
        console.error('Error loading posts:', error);
        showNotification('Failed to load posts', true);
        return [];
    }
}

async function handlePostSubmit(e) {
    e.preventDefault();
    
    if (!currentUser) {
        showNotification('You must be logged in to post', true);
        return;
    }

    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Publishing...';

    try {
        const type = document.getElementById('postType').value;
        const title = document.getElementById('postTitle').value;
        const content = document.getElementById('postContent').value;

        let imageUrl = null;

        if (selectedImageFile) {
            showNotification('Uploading image...');
            imageUrl = await uploadImage(selectedImageFile);
        }

        const { data, error } = await supabaseClient
            .from('posts')
            .insert([
                { 
                    type: type,
                    title: title,
                    content: content,
                    image_url: imageUrl
                }
            ])
            .select();

        if (error) throw error;

        document.getElementById('postType').value = 'text';
        document.getElementById('postTitle').value = '';
        document.getElementById('postContent').value = '';
        removeImage();

        showNotification('Post published successfully! ✨');
        loadPosts();
    } catch (error) {
        showNotification('Failed to create post: ' + error.message, true);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Publish Post';
    }
}

async function deletePost(id) {
    if (!currentUser) {
        showNotification('You must be logged in to delete posts', true);
        return;
    }

    if (!confirm('Delete this post?')) return;

    try {
        const { error } = await supabaseClient
            .from('posts')
            .delete()
            .eq('id', id);

        if (error) throw error;

        showNotification('Post deleted');
        loadPosts();
    } catch (error) {
        showNotification('Failed to delete post: ' + error.message, true);
    }
}

// ===== RENDER FUNCTIONS =====
function updateStats(postCount) {
    const postCountEl = document.getElementById('postCount');
    const projectCountEl = document.getElementById('projectCount');
    if (postCountEl) postCountEl.textContent = postCount;
    if (projectCountEl) projectCountEl.textContent = '2';
}

function renderRecentPosts(posts) {
    const container = document.getElementById('recentPosts');
    if (!container) return; // page has no recent-posts widget; nothing to do

    if (posts.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                No posts yet. ${currentUser ? 'Create your first post! →' : 'Check back soon!'}
            </div>
        `;
        return;
    }
    
    const recentPosts = posts.slice(0, 5);
    container.innerHTML = recentPosts.map(post => {
        const date = new Date(post.created_at).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
        
        return `
            <div class="post-card" data-post-id="${post.id}">
                ${post.image_url ? `
                    <img src="${post.image_url}" alt="${post.title}">
                ` : ''}
                <div class="post-card-body">
                    <div class="post-card-header">
                        <h3 class="post-card-title">${post.title}</h3>
                        <span class="post-card-badge">${post.type}</span>
                    </div>
                    <p class="post-card-excerpt">${post.content}</p>
                    <div class="post-card-footer">
                        <span class="post-card-date">${date}</span>
                        ${currentUser ? `<button class="btn-delete-post" data-post-id="${post.id}">Delete</button>` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Attach event listeners
    container.querySelectorAll('.post-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (!e.target.classList.contains('btn-delete-post')) {
                viewPost(card.dataset.postId);
            }
        });
    });

    container.querySelectorAll('.btn-delete-post').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            deletePost(btn.dataset.postId);
        });
    });
}

// ===== NAVIGATION FUNCTIONS =====
async function viewPost(id) {
    try {
        const { data, error } = await supabaseClient
            .from('posts')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        const date = new Date(data.created_at).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });

        const main = document.getElementById('mainContent');
        main.innerHTML = `
            <div class="post-detail">
                ${data.image_url ? `
                    <img src="${data.image_url}" alt="${data.title}">
                ` : ''}
                <div class="post-detail-body">
                    <button id="btnBackHome" class="back-link">← Back to Home</button>
                    <div class="post-detail-header">
                        <h1 class="post-detail-title">${data.title}</h1>
                        <span class="post-card-badge">${data.type}</span>
                    </div>
                    <div class="post-detail-date">${date}</div>
                    <div class="post-detail-content">${data.content}</div>
                </div>
            </div>
        `;

        document.getElementById('btnBackHome').addEventListener('click', showHome);
    } catch (error) {
        showNotification('Failed to load post', true);
    }
}

function showHome() {
    location.reload();
}

async function showPosts() {
    const posts = await loadPosts();
    const main = document.getElementById('mainContent');
    
    if (posts.length === 0) {
        main.innerHTML = `
            <div class="panel panel--solid panel--lg panel--center">
                <h2 class="panel-title">All Posts</h2>
                <p class="lead-text">No posts yet. ${currentUser ? 'Create your first post!' : 'Check back soon!'}</p>
            </div>
        `;
        return;
    }
    
    main.innerHTML = `
        <div class="panel panel--solid panel--lg">
            <div class="panel-header">
                <h2 class="panel-title">All Posts</h2>
                <button id="btnBackFromPosts" class="back-link">← Back</button>
            </div>
            <div class="post-list" id="allPostsContainer">
                ${posts.map(post => {
                    const date = new Date(post.created_at).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric' 
                    });
                    return `
                        <div class="post-card" data-post-id="${post.id}">
                            ${post.image_url ? `
                                <img src="${post.image_url}" alt="${post.title}">
                            ` : ''}
                            <div class="post-card-body">
                                <div class="post-card-header">
                                    <h3 class="post-card-title">${post.title}</h3>
                                    <span class="post-card-badge">${post.type}</span>
                                </div>
                                <p class="post-card-excerpt">${post.content.substring(0, 150)}${post.content.length > 150 ? '...' : ''}</p>
                                <span class="post-card-date">${date}</span>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;

    document.getElementById('btnBackFromPosts').addEventListener('click', showHome);
    
    document.querySelectorAll('#allPostsContainer .post-card').forEach(card => {
        card.addEventListener('click', () => viewPost(card.dataset.postId));
    });
}
function showProjects() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `
    <div class="panel panel--solid panel--lg">
      <div class="panel-header">
        <h2 class="panel-title">Projects</h2>
        <button id="btnBackFromProjects" class="back-link">← Back</button>
      </div>
      <div class="text-list">
        <div>🚧 Project 1 — coming soon</div>
        <div>🚧 Project 2 — coming soon</div>
      </div>
    </div>
  `;
  document.getElementById('btnBackFromProjects').addEventListener('click', showHome);
}
function showContact() {
    const main = document.getElementById('mainContent');
    main.innerHTML = `
        <div class="panel panel--solid panel--lg">
            <div class="panel-header">
                <h2 class="panel-title">Get in Touch</h2>
                <button id="btnBackFromContact" class="back-link">← Back</button>
            </div>
            <p class="lead-text">
                Want to collaborate or just say hi? I'd love to hear from you!
            </p>
            <div class="text-list">
                <div>📧 Email: alyrball@gmail.com</div>
                <div>🐦 Twitter: @arbyees_</div>
                <div>💻 GitHub: kazoo-gif</div>
            </div>
        </div>
    `;

    document.getElementById('btnBackFromContact').addEventListener('click', showHome);
}

function scrollToNewPost() {
    if (currentUser) {
        document.getElementById('postFormContainer').scrollIntoView({ behavior: 'smooth' });
        document.getElementById('postTitle').focus();
    } else {
        document.getElementById('loginForm').scrollIntoView({ behavior: 'smooth' });
        showNotification('Please login to create posts');
    }
}

// ===== UTILITY FUNCTIONS =====
function showNotification(message, isError = false) {
    const notif = document.createElement('div');
    notif.className = `toast${isError ? ' toast--error' : ''}`;
    notif.textContent = message;
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 3000);
}

function updateClock() {
    const now = new Date();
    const time = now.toTimeString().split(' ')[0];
    const clockEl = document.getElementById('clock');
    if (clockEl) {
        clockEl.textContent = time;
    }
}

// ===== INITIALIZE =====
function initializeBlog() {
    // Initialize Supabase client
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    
    // Set up event listeners
    const loginForm = document.getElementById('loginFormElement');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    const postForm = document.getElementById('postFormElement');
    if (postForm) {
        postForm.addEventListener('submit', handlePostSubmit);
    }

    const logoutBtn = document.getElementById('btnLogout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    const postImage = document.getElementById('postImage');
    if (postImage) {
        postImage.addEventListener('change', previewImage);
    }

    const removeImageBtn = document.getElementById('btnRemoveImage');
    if (removeImageBtn) {
        removeImageBtn.addEventListener('click', removeImage);
    }

    // Navigation
    const navHome = document.getElementById('navHome');
    if (navHome) {
        navHome.addEventListener('click', (e) => {
            e.preventDefault();
            showHome();
        });
    }

    const navPosts = document.getElementById('navPosts');
    if (navPosts) {
        navPosts.addEventListener('click', (e) => {
            e.preventDefault();
            showPosts();
        });
    }
    const navProjects = document.getElementById('navProjects');
    if (navProjects) {
      navProjects.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = 'projects.html';
      });
    }
    const navContact = document.getElementById('navContact');
    if (navContact) {
        navContact.addEventListener('click', (e) => {
            e.preventDefault();
            showContact();
        });
    }

    const btnViewPosts = document.getElementById('btnViewPosts');
    if (btnViewPosts) {
        btnViewPosts.addEventListener('click', showPosts);
    }

    const btnCreatePost = document.getElementById('btnCreatePost');
    if (btnCreatePost) {
        btnCreatePost.addEventListener('click', scrollToNewPost);
    }

    // Start clock
    setInterval(updateClock, 1000);
    updateClock();

    // Load initial data
    checkAuth();
    loadPosts();
}

// Wait for DOM to be fully loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeBlog);
} else {
    initializeBlog();
}
