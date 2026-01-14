// ===== CONFIGURATION =====
// 🔧 REPLACE THESE WITH YOUR SUPABASE VALUES!
const SUPABASE_URL = 'YOUR_SUPABASE_URL_HERE';  // Like: https://xxxxx.supabase.co
const SUPABASE_KEY = 'YOUR_ANON_KEY_HERE';      // Your anon/public key

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
        loginForm.classList.add('hidden');
        postForm.classList.remove('hidden');
        statusText.textContent = '✓ Logged in as Admin';
    } else {
        loginForm.classList.remove('hidden');
        postForm.classList.add('hidden');
        statusText.textContent = 'Visitor Mode';
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
    document.getElementById('postCount').textContent = postCount;
    document.getElementById('projectCount').textContent = '2';
}

function renderRecentPosts(posts) {
    const container = document.getElementById('recentPosts');
    
    if (posts.length === 0) {
        container.innerHTML = `
            <div class="text-white/70 text-sm text-center py-8">
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
            <div class="post-card bg-white/40 rounded-lg overflow-hidden cursor-pointer" data-post-id="${post.id}">
                ${post.image_url ? `
                    <img src="${post.image_url}" alt="${post.title}" 
                         class="w-full h-48 object-cover">
                ` : ''}
                <div class="p-4">
                    <div class="flex justify-between items-start mb-2">
                        <h3 class="font-semibold text-white">${post.title}</h3>
                        <span class="text-xs text-white/60 bg-white/30 px-2 py-1 rounded">${post.type}</span>
                    </div>
                    <p class="text-white/80 text-sm mb-2 line-clamp-2">${post.content}</p>
                    <div class="flex justify-between items-center">
                        <span class="text-xs text-white/60">${date}</span>
                        ${currentUser ? `<button class="btn-delete-post text-xs text-red-300 hover:text-red-200" data-post-id="${post.id}">Delete</button>` : ''}
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
            <div class="bg-white/40 rounded-lg overflow-hidden">
                ${data.image_url ? `
                    <img src="${data.image_url}" alt="${data.title}" 
                         class="w-full h-96 object-cover">
                ` : ''}
                <div class="p-6">
                    <button id="btnBackHome" class="text-white/70 hover:text-white text-sm mb-4">← Back to Home</button>
                    <div class="flex justify-between items-start mb-4">
                        <h1 class="text-3xl font-bold text-white">${data.title}</h1>
                        <span class="text-sm text-white/60 bg-white/30 px-3 py-1 rounded">${data.type}</span>
                    </div>
                    <div class="text-white/70 text-sm mb-4">${date}</div>
                    <div class="text-white/90 text-base leading-relaxed whitespace-pre-wrap">${data.content}</div>
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
            <div class="bg-white/40 rounded-lg p-6 text-center">
                <h2 class="text-2xl font-bold text-white mb-3">All Posts</h2>
                <p class="text-white/70">No posts yet. ${currentUser ? 'Create your first post!' : 'Check back soon!'}</p>
            </div>
        `;
        return;
    }
    
    main.innerHTML = `
        <div class="bg-white/40 rounded-lg p-6">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-white">All Posts</h2>
                <button id="btnBackFromPosts" class="text-white/70 hover:text-white text-sm">← Back</button>
            </div>
            <div class="space-y-3" id="allPostsContainer">
                ${posts.map(post => {
                    const date = new Date(post.created_at).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric' 
                    });
                    return `
                        <div class="post-card bg-white/30 rounded-lg overflow-hidden cursor-pointer" data-post-id="${post.id}">
                            ${post.image_url ? `
                                <img src="${post.image_url}" alt="${post.title}" 
                                     class="w-full h-48 object-cover">
                            ` : ''}
                            <div class="p-4">
                                <div class="flex justify-between items-start mb-2">
                                    <h3 class="font-semibold text-white">${post.title}</h3>
                                    <span class="text-xs text-white/60 bg-white/30 px-2 py-1 rounded">${post.type}</span>
                                </div>
                                <p class="text-white/80 text-sm mb-2">${post.content.substring(0, 150)}${post.content.length > 150 ? '...' : ''}</p>
                                <span class="text-xs text-white/60">${date}</span>
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
        <div class="bg-white/40 rounded-lg p-6">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-white">My Projects</h2>
                <button id="btnBackFromProjects" class="text-white/70 hover:text-white text-sm">← Back</button>
            </div>
            <div class="space-y-4">
                <div class="bg-white/30 rounded-lg p-4">
                    <h3 class="font-semibold text-white text-lg mb-2">Pixelated Dreams</h3>
                    <p class="text-white/80 text-sm mb-3">A surreal retro game where you jump through a world of floating objects, glitch effects, and neon pastels.</p>
                    <a href="#" class="text-purple-300 hover:text-purple-200 text-sm font-semibold">
                        Check it out →
                    </a>
                </div>
                <div class="bg-white/30 rounded-lg p-4">
                    <h3 class="font-semibold text-white text-lg mb-2">Neon Escape</h3>
                    <p class="text-white/80 text-sm mb-3">A dreamlike game where the character navigates through a city filled with pixelated stars, clouds, and fuzzy neon lights.</p>
                    <a href="#" class="text-purple-300 hover:text-purple-200 text-sm font-semibold">
                        Explore it →
                    </a>
                </div>
            </div>
        </div>
    `;

    document.getElementById('btnBackFromProjects').addEventListener('click', showHome);
}

function showContact() {
    const main = document.getElementById('mainContent');
    main.innerHTML = `
        <div class="bg-white/40 rounded-lg p-6">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-white">Get in Touch</h2>
                <button id="btnBackFromContact" class="text-white/70 hover:text-white text-sm">← Back</button>
            </div>
            <p class="text-white/90 mb-4">
                Want to collaborate or just say hi? I'd love to hear from you!
            </p>
            <div class="space-y-3 text-white/80">
                <div>📧 Email: your-email@example.com</div>
                <div>🐦 Twitter: @yourhandle</div>
                <div>💻 GitHub: yourusername</div>
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
    notif.className = `fixed top-4 right-4 ${isError ? 'bg-red-400' : 'bg-purple-400'} text-white px-4 py-3 rounded-lg shadow-lg z-50`;
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
    document.getElementById('navHome').addEventListener('click', (e) => {
        e.preventDefault();
        showHome();
    });
    
    document.getElementById('navPosts').addEventListener('click', (e) => {
        e.preventDefault();
        showPosts();
    });
    
    document.getElementById('navProjects').addEventListener('click', (e) => {
        e.preventDefault();
        showProjects();
    });
    
    document.getElementById('navContact').addEventListener('click', (e) => {
        e.preventDefault();
        showContact();
    });

    document.getElementById('btnViewPosts').addEventListener('click', showPosts);
    document.getElementById('btnCreatePost').addEventListener('click', scrollToNewPost);

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