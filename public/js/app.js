// 全局变量
const API_BASE = '/api';
let currentUser = null;
let token = localStorage.getItem('token');

// 分页状态
let modpackCurrentPage = 1;
let memberCurrentPage = 1;
let messageCurrentPage = 1;

// 通用分页渲染函数（支持URL路由）
function renderPagination(containerId, pagination, pageType) {
    const { page, pages } = pagination;
    if (pages <= 1) {
        const el = document.getElementById(containerId);
        if (el) el.remove();
        return;
    }
    let el = document.getElementById(containerId);
    if (!el) {
        const parent = document.getElementById(containerId.replace('-pagination', '-page'));
        if (parent) {
            parent.insertAdjacentHTML('beforeend', `<div class="pagination" id="${containerId}" style="margin-top: 25px; text-align: center; padding: 15px 0;"></div>`);
            el = document.getElementById(containerId);
        }
    }
    if (!el) return;
    
    // 生成URL
    const currentPath = window.location.pathname;
    const basePath = currentPath.split('?')[0];
    const prevPage = page - 1;
    const nextPage = page + 1;
    
    const prevUrl = prevPage >= 1 ? `${basePath}?page=${prevPage}` : '#';
    const nextUrl = nextPage <= pages ? `${basePath}?page=${nextPage}` : '#';
    const prevDisabled = page <= 1 ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : '';
    const nextDisabled = page >= pages ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : '';
    
    el.innerHTML = `
        <a href="${prevUrl}" class="btn btn-secondary" ${prevDisabled} onclick="changePage('${pageType}', -1); return false;">上一页</a>
        <span style="margin: 0 15px; font-size: 14px; color: var(--text-secondary);">第 ${page} 页 / 共 ${pages} 页</span>
        <a href="${nextUrl}" class="btn btn-secondary" ${nextDisabled} onclick="changePage('${pageType}', 1); return false;">下一页</a>
    `;
}

// 切换页面（更新URL）
function changePage(pageType, direction) {
    const currentPath = window.location.pathname;
    const urlParams = new URLSearchParams(window.location.search);
    const currentPage = parseInt(urlParams.get('page') || '1');
    const newPage = currentPage + direction;
    
    if (newPage < 1) return;
    
    // 更新URL参数
    urlParams.set('page', newPage);
    const newUrl = `${currentPath}?${urlParams.toString()}`;
    
    // 使用History API更新URL（不刷新页面）
    window.history.pushState({ pageType, page: newPage }, '', newUrl);
    
    // 重新加载当前页面
    parseUrlAndNavigate();
}

// 应用初始化
document.addEventListener('DOMContentLoaded', function() {
    initApp();
});

async function initApp() {
    // 检查登录状态
    if (token) {
        await loadCurrentUser();
    }
    
    // 初始化导航
    initNavigation();
    
    // 初始化表单
    initForms();
    
    // 初始化珍宝阁按钮事件（在DOM中一次性绑定）
    bindGalleryButtons();
    
    // 解析URL并加载对应页面
    parseUrlAndNavigate();
    
    // 监听浏览器前进/后退
    window.addEventListener('popstate', () => {
        parseUrlAndNavigate();
    });
    
    // 初始化模态框
    initModal();
    
    // 初始化音乐控制
    initMusicControl();
    
    // 初始化粒子背景
    initParticles();
}

// 加载当前用户信息
async function loadCurrentUser() {
    try {
        const response = await fetch(`${API_BASE}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            updateNavigation();
        } else {
            // Token无效，清除本地存储
            localStorage.removeItem('token');
            token = null;
        }
    } catch (error) {
        console.error('加载用户信息失败:', error);
    }
}

// 初始化导航
function initNavigation() {
    // 导航链接点击事件
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.getAttribute('data-page');
            navigateToPage(page);
        });
    });
}

// 导航到指定页面（支持URL路由分页）
function navigateToPage(page, params = {}) {
    // 隐藏所有页面
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    
    // 移除文章详情页的浮动导航按钮（在非文章页）
    if (page !== 'story-detail') {
        const articleNav = document.querySelector('.article-nav');
        if (articleNav) {
            articleNav.remove();
        }
    }
    
    // 显示目标页面
    const targetPage = document.getElementById(`${page}-page`);
    if (targetPage) {
        targetPage.classList.add('active');
        
        // 更新导航激活状态
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('data-page') === page) {
                link.classList.add('active');
            }
        });
        
        // 加载页面数据（传递分页参数）
        loadPageData(page, params);
    }
}

// 加载页面数据（支持分页参数）
function loadPageData(page, params = {}) {
    switch (page) {
        case 'home':
            modpackCurrentPage = params.page || 1;
            loadHomePage();
            break;
        case 'stories':
            loadStoriesPage();
            break;
        case 'members':
            memberCurrentPage = params.page || 1;
            loadMembersPage();
            break;
        case 'messages':
            messageCurrentPage = params.page || 1;
            loadMessagesPage();
            break;
        case 'profile':
            loadProfilePage();
            break;
        case 'review':
            loadReviewPage();
            break;
        case 'gallery':
            updateAdminFeatures();
            loadGalleryPage();
            break;
    }
}

// 加载首页数据（整合包分页）
async function loadHomePage() {
    try {
        const response = await fetch(`${API_BASE}/modpacks?page=${modpackCurrentPage}&limit=12`);
        if (response.ok) {
            const data = await response.json();
            displayModpacks(data.modpacks);
            renderPagination('modpack-pagination', data.pagination, 'modpack');
        }
    } catch (error) {
        console.error('加载整合包失败:', error);
    }
}

// 显示整合包
function displayModpacks(modpacks) {
    const container = document.getElementById('modpacks-grid');
    container.innerHTML = '';
    
    // 按ID去重，防止重复渲染
    const seen = new Set();
    modpacks.forEach(modpack => {
        if (seen.has(modpack.id)) return;
        seen.add(modpack.id);
        const card = createModpackCard(modpack);
        container.appendChild(card);
    });
    
    // 显示/隐藏管理员功能
    updateAdminFeatures();
}

// 创建整合包卡片
function createModpackCard(modpack) {
    const card = document.createElement('div');
    card.className = 'modpack-card';
    card.style.cursor = 'pointer';
    card.innerHTML = `
        ${currentUser && currentUser.role === 'admin' ? `
            <div class="admin-actions">
                <button class="btn btn-small btn-primary" onclick="editModpack(${modpack.id})">编辑</button>
                <button class="btn btn-small btn-danger" onclick="deleteModpack(${modpack.id})">删除</button>
            </div>
        ` : ''}
        ${modpack.image_url ? `
            <img src="${modpack.image_url}" alt="${modpack.name}" class="modpack-image" loading="lazy">
        ` : `
            <div class="modpack-image" style="background-color: var(--primary-color); display: flex; align-items: center; justify-content: center; color: var(--text-secondary);">暂无图片</div>
        `}
        <div class="modpack-content">
            <h3 class="modpack-title">${modpack.name}</h3>
            <p class="modpack-description">${modpack.description}</p>
            <div class="modpack-actions">
                ${modpack.download_link ? `
                    <a href="javascript:void(0)" class="btn btn-primary" onclick="downloadModpack(${modpack.id}, event)">下载</a>
                ` : ''}
                ${!currentUser || currentUser.role !== 'admin' ? `
                    <button class="btn btn-secondary" onclick="requestEdit(${modpack.id}); event.stopPropagation()">申请修改</button>
                ` : ''}
            </div>
        </div>
    `;
    
    // 点击卡片显示详情和评论
    card.addEventListener('click', () => {
        showModpackDetail(modpack);
    });
    
    return card;
}

// 加载成员页面（分页）
async function loadMembersPage() {
    try {
        const response = await fetch(`${API_BASE}/members?page=${memberCurrentPage}&limit=12`);
        if (response.ok) {
            const data = await response.json();
            displayMembers(data.members);
            renderPagination('member-pagination', data.pagination, 'member');
        }
    } catch (error) {
        console.error('加载成员失败:', error);
    }
}

// 切换成员页码
function changeMemberPage(direction) {
    const newPage = memberCurrentPage + direction;
    if (newPage < 1) return;
    memberCurrentPage = newPage;
    loadMembersPage();
}

// 显示成员
function displayMembers(members) {
    const container = document.getElementById('members-grid');
    container.innerHTML = '';
    
    // 按ID去重，防止重复渲染
    const seen = new Set();
    members.forEach(member => {
        if (seen.has(member.id)) return;
        seen.add(member.id);
        const card = createMemberCard(member);
        container.appendChild(card);
    });
    
    updateAdminFeatures();
}

// 创建成员卡片
function createMemberCard(member) {
    const card = document.createElement('div');
    card.className = 'member-card';
    card.innerHTML = `
        ${currentUser && currentUser.role === 'admin' ? `
            <div class="admin-actions">
                <button class="btn btn-small btn-primary" onclick="editMember(${member.id})">编辑</button>
                <button class="btn btn-small btn-danger" onclick="deleteMember(${member.id})">删除</button>
            </div>
        ` : ''}
        ${member.avatar_url ? `
            <img src="${member.avatar_url}" alt="${member.name}" class="member-avatar" loading="lazy">
        ` : `
            <div class="member-avatar" style="background-color: var(--primary-color); display: flex; align-items: center; justify-content: center; color: var(--text-secondary); font-size: 36px;">?</div>
        `}
        <h3 class="member-name">${member.name}</h3>
        ${member.role ? `<p class="member-role">${member.role}</p>` : ''}
        ${member.description ? `<p class="member-description">${member.description}</p>` : ''}
    `;
    return card;
}

// 加载留言板页面（分页）
async function loadMessagesPage() {
    try {
        const response = await fetch(`${API_BASE}/messages?page=${messageCurrentPage}&limit=15`);
        if (response.ok) {
            const data = await response.json();
            displayMessages(data.messages);
            renderPagination('message-pagination', data.pagination, 'message');
        }
    } catch (error) {
        console.error('加载留言失败:', error);
    }
    
    // 更新留言表单显示状态
    updateMessageForm();
}

// 显示留言
function displayMessages(messages) {
    const container = document.getElementById('messages-list');
    container.innerHTML = '';
    
    messages.forEach(message => {
        const messageItem = createMessageItem(message);
        container.appendChild(messageItem);
    });
}

// 创建留言项
function createMessageItem(message) {
    const item = document.createElement('div');
    item.className = 'message-item';
    
    const time = new Date(message.created_at).toLocaleString('zh-CN');
    
    item.innerHTML = `
        <div class="message-header">
            <span class="message-author">${message.display_name || message.username}</span>
            <span class="message-time">${time}</span>
            ${currentUser && (currentUser.id === message.user_id || currentUser.role === 'admin') ? `
                <button class="btn btn-small btn-danger" onclick="deleteMessage(${message.id})" style="margin-left: auto;">删除</button>
            ` : ''}
        </div>
        <div class="message-content">${message.content}</div>
    `;
    
    return item;
}

// 更新留言表单显示状态
function updateMessageForm() {
    const formContainer = document.getElementById('message-form-container');
    const loginPrompt = document.getElementById('login-to-message');
    
    if (currentUser) {
        formContainer.style.display = 'block';
        loginPrompt.style.display = 'none';
    } else {
        formContainer.style.display = 'none';
        loginPrompt.style.display = 'block';
    }
}

// 删除留言
async function deleteMessage(messageId) {
    const confirmed = await confirm('确定要删除这条留言吗？', '删除确认');
    if (!confirmed) return;
    
    try {
        const response = await fetch(`${API_BASE}/messages/${messageId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            showSuccessMessage('留言删除成功');
            loadMessagesPage();
        } else {
            const data = await response.json();
            showError(data.error || '删除失败');
        }
    } catch (error) {
        console.error('删除留言失败:', error);
        showError('删除失败');
    }
}

// 加载个人中心页面
async function loadProfilePage() {
    if (!currentUser) {
        navigateToPage('login');
        return;
    }
    
    // 先从API获取最新用户信息
    try {
        const response = await fetch(`${API_BASE}/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            localStorage.setItem('user', JSON.stringify(currentUser));
        }
    } catch (error) {
        // 静默失败，使用缓存的数据
    }
    
    document.getElementById('profile-username').textContent = currentUser.display_name || currentUser.username;
    document.getElementById('profile-email').textContent = currentUser.email;
    document.getElementById('profile-role').textContent = currentUser.role === 'admin' ? '管理员' : '普通用户';
    
    // 头像
    const avatarImg = document.getElementById('profile-avatar');
    if (currentUser.avatar) {
        avatarImg.src = currentUser.avatar;
    } else {
        avatarImg.src = '/images/default-avatar.svg';
    }
    
    // 邮箱验证状态
    const verifiedBadge = document.getElementById('email-verified-badge');
    const unverifiedBadge = document.getElementById('email-unverified-badge');
    if (currentUser.email_verified) {
        verifiedBadge.style.display = 'inline';
        unverifiedBadge.style.display = 'none';
    } else {
        verifiedBadge.style.display = 'none';
        unverifiedBadge.style.display = 'inline';
    }
}

// 头像上传
async function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // 验证文件大小（最大2MB）
    if (file.size > 2 * 1024 * 1024) {
        showError('头像文件大小不能超过2MB');
        event.target.value = '';
        return;
    }
    
    // 验证文件类型
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
        showError('只支持 JPG、PNG、GIF、WebP 格式的图片');
        event.target.value = '';
        return;
    }
    
    const formData = new FormData();
    formData.append('avatar', file);
    
    try {
        const response = await fetch(`${API_BASE}/auth/upload-avatar`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentUser.avatar = data.avatar;
            document.getElementById('profile-avatar').src = data.avatar;
            updateNavigation();
            showSuccessMessage('头像更新成功！');
        } else {
            showError(data.error || '上传失败');
        }
    } catch (error) {
        console.error('上传头像错误:', error);
        showError('上传失败，请稍后重试');
    }
    
    // 清空input以便重复选择同一文件
    event.target.value = '';
}

// 已注册用户重新发送验证码
async function handleSendVerifyEmail() {
    if (!currentUser) return;
    
    try {
        const response = await fetch(`${API_BASE}/auth/send-code`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: currentUser.email })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showSuccessMessage('验证码已发送到邮箱');
        } else {
            showError(data.error || '发送失败');
        }
    } catch (error) {
        console.error('发送验证码错误:', error);
        showError('发送失败，请稍后重试');
    }
}

// ========== 忘记密码 ==========

let forgotCodeCountdown = 0;
let forgotCodeTimer = null;

// 发送忘记密码验证码
async function handleForgotSendCode() {
    const email = document.getElementById('forgot-email').value.trim();
    if (!email) {
        showError('请输入邮箱地址');
        return;
    }

    const emailReg = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailReg.test(email)) {
        showError('请输入有效的邮箱地址');
        return;
    }

    const btn = document.getElementById('forgot-send-code-btn');
    btn.disabled = true;
    btn.textContent = '发送中...';

    try {
        const response = await fetch(`${API_BASE}/auth/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        const data = await response.json();

        if (response.ok) {
            showSuccessMessage(data.message || '验证码已发送');

            // 显示验证码输入框和新密码输入框
            document.getElementById('forgot-code-group').style.display = 'block';
            document.getElementById('forgot-password-group').style.display = 'block';
            document.getElementById('forgot-reset-btn').style.display = 'block';
            document.getElementById('forgot-code').value = ''; // 清空旧验证码
            document.getElementById('forgot-code').focus();

            // 启动验证码有效期倒计时（3分钟）
            startCodeValidityCountdown('forgot', 'forgot-code-remain-time', 180);

            // 倒计时60秒（发送冷却）
            forgotCodeCountdown = 60;
            btn.textContent = `${forgotCodeCountdown}s`;
            forgotCodeTimer = setInterval(() => {
                forgotCodeCountdown--;
                if (forgotCodeCountdown <= 0) {
                    clearInterval(forgotCodeTimer);
                    btn.disabled = false;
                    btn.textContent = '重新发送';
                } else {
                    btn.textContent = `${forgotCodeCountdown}s`;
                }
            }, 1000);
        } else {
            showError(data.error || '发送验证码失败');
            btn.disabled = false;
            btn.textContent = '发送验证码';
        }
    } catch (error) {
        console.error('发送验证码错误:', error);
        showError('发送验证码失败，请稍后重试');
        btn.disabled = false;
        btn.textContent = '发送验证码';
    }
}

// 提交重置密码
async function handleResetPassword(e) {
    e.preventDefault();

    const email = document.getElementById('forgot-email').value.trim();
    const code = document.getElementById('forgot-code').value.trim();
    const newPassword = document.getElementById('forgot-new-password').value;

    if (!code) {
        showError('请输入验证码');
        return;
    }
    if (code.length !== 6) {
        showError('验证码应为6位数字');
        return;
    }
    if (!newPassword || newPassword.length < 6) {
        showError('新密码长度至少为6位');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, code, newPassword })
        });

        const data = await response.json();

        if (response.ok) {
            showSuccessMessage('密码重置成功！请使用新密码登录');
            // 清理表单和倒计时
            document.getElementById('forgot-form-step1').reset();
            document.getElementById('forgot-code-group').style.display = 'none';
            document.getElementById('forgot-password-group').style.display = 'none';
            document.getElementById('forgot-reset-btn').style.display = 'none';
            if (forgotCodeTimer) clearInterval(forgotCodeTimer);
            const btn = document.getElementById('forgot-send-code-btn');
            btn.disabled = false;
            btn.textContent = '发送验证码';
            // 切回登录
            switchTab('login');
        } else {
            showError(data.error || '重置失败');
        }
    } catch (error) {
        console.error('重置密码错误:', error);
        showError('重置失败，请稍后重试');
    }
}

// 初始化表单
function initForms() {
    // 登录表单
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    
    // 注册表单
    document.getElementById('register-form-step1').addEventListener('submit', handleRegister);
    
    // 留言表单
    document.getElementById('message-form').addEventListener('submit', handleMessageSubmit);
    
    // 修改密码表单
    document.getElementById('change-password-form').addEventListener('submit', handleChangePassword);
    
    // 忘记密码表单
    document.getElementById('forgot-form-step1').addEventListener('submit', handleResetPassword);
    
    // 退出登录
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    
    // 标签切换
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tab = e.target.getAttribute('data-tab');
            switchTab(tab);
        });
    });
    
    // 新增按钮
    document.getElementById('add-modpack-btn').addEventListener('click', () => showModpackModal());
    document.getElementById('add-member-btn').addEventListener('click', () => showMemberModal());
}

// 初始化模态框
function initModal() {
    const modal = document.getElementById('modal');
    const closeBtn = document.querySelector('.modal-close');
    
    // 点击关闭按钮
    closeBtn.addEventListener('click', hideModal);
    
    // 点击模态框外部关闭
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            hideModal();
        }
    });
}

// 显示模态框
function showModal(title, content) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = content;
    document.getElementById('modal').classList.add('active');
}

// 隐藏模态框
function hideModal() {
    document.getElementById('modal').classList.remove('active');
    document.getElementById('modal-body').innerHTML = '';
}

// 显示整合包模态框
function showModpackModal(modpack = null) {
    const isEdit = modpack !== null;
    const title = isEdit ? '编辑整合包' : '新增整合包';
    
    const content = `
        <form id="modpack-form">
            <div class="form-group">
                <label for="modpack-name">整合包名称 *</label>
                <input type="text" id="modpack-name" class="form-control" value="${modpack?.name || ''}" required>
            </div>
            <div class="form-group">
                <label for="modpack-description">详细介绍 *</label>
                <textarea id="modpack-description" class="form-control" rows="5" required>${modpack?.description || ''}</textarea>
            </div>
            <div class="form-group">
                <label for="modpack-download">下载链接</label>
                <input type="url" id="modpack-download" class="form-control" value="${modpack?.download_link || ''}" placeholder="https://example.com/download">
            </div>
            <div class="form-group">
                <label for="modpack-image">图片</label>
                <input type="file" id="modpack-image" class="form-control" accept="image/*">
                ${modpack?.image_url ? `<p style="margin-top: 10px;">当前图片：<br><img src="${modpack.image_url}" style="max-width: 200px; max-height: 100px;"></p>` : ''}
            </div>
            <button type="submit" class="btn btn-primary">${isEdit ? '保存修改' : '创建整合包'}</button>
            <button type="button" class="btn btn-secondary" onclick="hideModal()">取消</button>
        </form>
    `;
    
    showModal(title, content);
    
    // 绑定表单提交事件
    document.getElementById('modpack-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleModpackSubmit(isEdit ? modpack.id : null);
    });
}

// 显示成员模态框
function showMemberModal(member = null) {
    const isEdit = member !== null;
    const title = isEdit ? '编辑成员' : '新增成员';
    
    const content = `
        <form id="member-form">
            <div class="form-group">
                <label for="member-name">成员名称 *</label>
                <input type="text" id="member-name" class="form-control" value="${member?.name || ''}" required>
            </div>
            <div class="form-group">
                <label for="member-role">角色</label>
                <input type="text" id="member-role" class="form-control" value="${member?.role || ''}" placeholder="例如：创始人、开发者">
            </div>
            <div class="form-group">
                <label for="member-description">描述</label>
                <textarea id="member-description" class="form-control" rows="3">${member?.description || ''}</textarea>
            </div>
            <div class="form-group">
                <label for="member-avatar">头像</label>
                <input type="file" id="member-avatar" class="form-control" accept="image/*">
                ${member?.avatar_url ? `<p style="margin-top: 10px;">当前头像：<br><img src="${member.avatar_url}" style="max-width: 100px; max-height: 100px; border-radius: 50%;"></p>` : ''}
            </div>
            <button type="submit" class="btn btn-primary">${isEdit ? '保存修改' : '添加成员'}</button>
            <button type="button" class="btn btn-secondary" onclick="hideModal()">取消</button>
        </form>
    `;
    
    showModal(title, content);
    
    // 绑定表单提交事件
    document.getElementById('member-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleMemberSubmit(isEdit ? member.id : null);
    });
}

// 处理整合包表单提交
async function handleModpackSubmit(modpackId = null) {
    if (!currentUser) {
        showError('请先登录');
        return;
    }
    
    // 检查权限：只有管理员可以编辑，所有用户都可以添加
    if (modpackId && currentUser.role !== 'admin') {
        showError('只有管理员可以编辑整合包');
        return;
    }
    
    try {
        const formData = new FormData();
        formData.append('name', document.getElementById('modpack-name').value);
        formData.append('description', document.getElementById('modpack-description').value);
        formData.append('download_link', document.getElementById('modpack-download').value);
        
        const imageFile = document.getElementById('modpack-image').files[0];
        if (imageFile) {
            formData.append('image', imageFile);
        }
        
        let url, method;
        
        if (modpackId) {
            // 编辑模式（只有管理员）
            url = `${API_BASE}/modpacks/${modpackId}`;
            method = 'PUT';
        } else if (currentUser.role === 'admin') {
            // 管理员添加 - 直接发布
            url = `${API_BASE}/modpacks`;
            method = 'POST';
        } else {
            // 普通用户添加 - 需要审核
            url = `${API_BASE}/modpacks/pending`;
            method = 'POST';
        }
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        
        const data = await response.json();
        
        if (response.ok) {
            if (modpackId) {
                showSuccessMessage('整合包更新成功！');
            } else if (currentUser.role === 'admin') {
                showSuccessMessage('整合包创建成功！');
            } else {
                showSuccessMessage('整合包已提交，等待管理员审核！');
            }
            hideModal();
            loadHomePage();
        } else {
            showError(data.error || '操作失败');
        }
    } catch (error) {
        console.error('提交整合包失败:', error);
        showError('操作失败，请稍后重试');
    }
}

// 处理成员表单提交
async function handleMemberSubmit(memberId = null) {
    if (!currentUser || currentUser.role !== 'admin') {
        showError('只有管理员可以操作');
        return;
    }
    
    try {
        const formData = new FormData();
        formData.append('name', document.getElementById('member-name').value);
        formData.append('role', document.getElementById('member-role').value);
        formData.append('description', document.getElementById('member-description').value);
        
        const avatarFile = document.getElementById('member-avatar').files[0];
        if (avatarFile) {
            formData.append('avatar', avatarFile);
        }
        
        const url = memberId ? `${API_BASE}/members/${memberId}` : `${API_BASE}/members`;
        const method = memberId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showSuccessMessage(memberId ? '成员更新成功！' : '成员添加成功！');
            hideModal();
            loadMembersPage();
        } else {
            showError(data.error || '操作失败');
        }
    } catch (error) {
        console.error('提交成员失败:', error);
        showError('操作失败，请稍后重试');
    }
}

// 编辑整合包
function editModpack(id) {
    fetch(`${API_BASE}/modpacks/${id}`)
        .then(response => response.json())
        .then(modpack => {
            showModpackModal(modpack);
        })
        .catch(error => {
            console.error('加载整合包失败:', error);
            showError('加载整合包失败');
        });
}

// 编辑成员
function editMember(id) {
    fetch(`${API_BASE}/members/${id}`)
        .then(response => response.json())
        .then(member => {
            showMemberModal(member);
        })
        .catch(error => {
            console.error('加载成员失败:', error);
            showError('加载成员失败');
        });
}

// 删除整合包
async function deleteModpack(id) {
    const confirmed = await confirm('确定要删除这个整合包吗？', '删除确认');
    if (!confirmed) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/modpacks/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showSuccessMessage('整合包删除成功！');
            loadHomePage();
        } else {
            showError(data.error || '删除失败');
        }
    } catch (error) {
        console.error('删除整合包失败:', error);
        showError('删除失败，请稍后重试');
    }
}

// 删除成员
async function deleteMember(id) {
    const confirmed = await confirm('确定要删除这个成员吗？', '删除确认');
    if (!confirmed) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/members/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showSuccessMessage('成员删除成功！');
            loadMembersPage();
        } else {
            showError(data.error || '删除失败');
        }
    } catch (error) {
        console.error('删除成员失败:', error);
        showError('删除失败，请稍后重试');
    }
}

// 下载整合包（通过API统计下载量）
async function downloadModpack(modpackId, event) {
    event.stopPropagation();
    try {
        const response = await fetch(`${API_BASE}/modpacks/${modpackId}/download`, {
            method: 'POST'
        });
        if (response.ok) {
            const data = await response.json();
            if (data.download_link) {
                window.open(data.download_link, '_blank');
            }
        }
    } catch (error) {
        console.error('下载失败:', error);
    }
}

// 申请修改整合包
function requestEdit(modpackId) {
    if (!currentUser) {
        showError('请先登录后再申请修改');
        navigateToPage('login');
        return;
    }
    
    const content = `
        <form id="request-form">
            <div class="form-group">
                <label for="request-type">修改类型</label>
                <select id="request-type" class="form-control">
                    <option value="update">更新信息</option>
                    <option value="fix">错误修正</option>
                </select>
            </div>
            <div class="form-group">
                <label for="request-name">整合包名称</label>
                <input type="text" id="request-name" class="form-control" placeholder="修改后的名称">
            </div>
            <div class="form-group">
                <label for="request-description">详细介绍</label>
                <textarea id="request-description" class="form-control" rows="5" placeholder="修改后的描述"></textarea>
            </div>
            <div class="form-group">
                <label for="request-download">下载链接</label>
                <input type="url" id="request-download" class="form-control" placeholder="修改后的下载链接">
            </div>
            <button type="submit" class="btn btn-primary">提交申请</button>
            <button type="button" class="btn btn-secondary" onclick="hideModal()">取消</button>
        </form>
    `;
    
    showModal('申请修改整合包', content);
    
    document.getElementById('request-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const requestData = {
            name: document.getElementById('request-name').value,
            description: document.getElementById('request-description').value,
            download_link: document.getElementById('request-download').value
        };
        
        try {
            const response = await fetch(`${API_BASE}/modpacks/${modpackId}/request`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    type: document.getElementById('request-type').value,
                    data: requestData
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                showError('修改申请已提交，等待管理员审核！');
                hideModal();
            } else {
                showError(data.error || '提交失败');
            }
        } catch (error) {
            console.error('提交申请失败:', error);
            showError('提交失败，请稍后重试');
        }
    });
}

// 处理登录
async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    
    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            token = data.token;
            currentUser = data.user;
            localStorage.setItem('token', token);
            
            showSuccessMessage('登录成功！');
            updateNavigation();
            navigateToPage('home');
            
            // 清空表单
            document.getElementById('login-form').reset();
        } else {
            showError(data.error || '登录失败');
        }
    } catch (error) {
        console.error('登录错误:', error);
        showError('登录失败，请稍后重试');
    }
}

// 发送邮箱验证码（注册用）
let codeCountdown = 0;
let codeTimer = null;
let codeValidityTimer = null; // 验证码有效期倒计时
let forgotCodeValidityTimer = null; // 忘记密码验证码有效期倒计时

// 验证码有效期倒计时（10分钟）
function startCodeValidityCountdown(timerId, elementId, totalSeconds) {
    if (timerId === 'register') {
        if (codeValidityTimer) clearInterval(codeValidityTimer);
    } else {
        if (forgotCodeValidityTimer) clearInterval(forgotCodeValidityTimer);
    }
    let remain = totalSeconds;
    const el = document.getElementById(elementId);
    function tick() {
        const m = Math.floor(remain / 60);
        const s = remain % 60;
        el.textContent = `${m}:${s.toString().padStart(2, '0')}`;
        if (remain <= 120) {
            el.parentElement.style.color = '#e94560'; // 最后2分钟变红
        } else {
            el.parentElement.style.color = 'var(--text-secondary)';
        }
        remain--;
        if (remain < 0) {
            el.textContent = '已过期';
            el.parentElement.style.color = '#e94560';
            if (timerId === 'register') clearInterval(codeValidityTimer);
            else clearInterval(forgotCodeValidityTimer);
        }
    }
    tick();
    const timer = setInterval(tick, 1000);
    if (timerId === 'register') codeValidityTimer = timer;
    else forgotCodeValidityTimer = timer;
}

async function handleSendCode() {
    const email = document.getElementById('register-email').value.trim();
    const username = document.getElementById('register-username').value.trim();
    if (!email) {
        showError('请先输入邮箱地址');
        return;
    }

    // 简单邮箱格式验证
    const emailReg = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailReg.test(email)) {
        showError('请输入有效的邮箱地址');
        return;
    }

    const btn = document.getElementById('send-code-btn');
    btn.disabled = true;
    btn.textContent = '发送中...';

    try {
        const response = await fetch(`${API_BASE}/auth/send-code`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, username })
        });

        const data = await response.json();

        if (response.ok) {
            // 显示验证码输入框
            document.getElementById('code-group').style.display = 'block';
            document.getElementById('register-code').value = ''; // 清空旧验证码
            document.getElementById('register-code').focus();
            
            // 启动验证码有效期倒计时（3分钟）
            startCodeValidityCountdown('register', 'code-remain-time', 180);
            
            // 倒计时60秒（发送冷却）
            codeCountdown = 60;
            btn.textContent = `${codeCountdown}s`;
            codeTimer = setInterval(() => {
                codeCountdown--;
                if (codeCountdown <= 0) {
                    clearInterval(codeTimer);
                    btn.disabled = false;
                    btn.textContent = '重新发送';
                } else {
                    btn.textContent = `${codeCountdown}s`;
                }
            }, 1000);
        } else {
            showError(data.error || '发送验证码失败');
            btn.disabled = false;
            btn.textContent = '发送验证码';
        }
    } catch (error) {
        console.error('发送验证码错误:', error);
        showError('发送验证码失败，请稍后重试');
        btn.disabled = false;
        btn.textContent = '发送验证码';
    }
}

// 处理注册（带验证码验证）
async function handleRegister(e) {
    e.preventDefault();
    
    const username = document.getElementById('register-username').value.trim();
    const account = document.getElementById('register-account').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;
    const verificationCode = document.getElementById('register-code').value.trim();
    
    if (!account) {
        showError('请输入账号');
        return;
    }

    if (!confirmPassword) {
        showError('请确认密码');
        return;
    }

    if (password !== confirmPassword) {
        showError('两次输入的密码不一致');
        return;
    }
    
    if (!verificationCode) {
        showError('请输入邮箱验证码');
        return;
    }
    
    if (verificationCode.length !== 6) {
        showError('验证码应为6位数字');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, account, email, password, confirmPassword, verificationCode })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            token = data.token;
            currentUser = data.user;
            localStorage.setItem('token', token);
            
            showSuccessMessage('注册成功！邮箱已验证');
            updateNavigation();
            navigateToPage('home');
            
            // 清空表单
            document.getElementById('register-form-step1').reset();
            document.getElementById('code-group').style.display = 'none';
            
            // 重置倒计时
            if (codeTimer) clearInterval(codeTimer);
            const btn = document.getElementById('send-code-btn');
            btn.disabled = false;
            btn.textContent = '发送验证码';
        } else {
            showError(data.error || '注册失败');
        }
    } catch (error) {
        console.error('注册错误:', error);
        showError('注册失败，请稍后重试');
    }
}

// 处理留言提交
async function handleMessageSubmit(e) {
    e.preventDefault();
    
    if (!currentUser) {
        showError('请先登录');
        return;
    }
    
    const content = document.getElementById('message-content').value;
    
    try {
        const response = await fetch(`${API_BASE}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ content })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showSuccessMessage('留言发布成功！');
            document.getElementById('message-form').reset();
            loadMessagesPage();
        } else {
            showError(data.error || '发布失败');
        }
    } catch (error) {
        console.error('发布留言错误:', error);
        showError('发布失败，请稍后重试');
    }
}

// 处理修改密码
async function handleChangePassword(e) {
    e.preventDefault();
    
    if (!currentUser) {
        showError('请先登录');
        return;
    }
    
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    
    try {
        const response = await fetch(`${API_BASE}/auth/change-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ currentPassword, newPassword })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showSuccessMessage('密码修改成功！');
            document.getElementById('change-password-form').reset();
        } else {
            showError(data.error || '修改失败');
        }
    } catch (error) {
        console.error('修改密码错误:', error);
        showError('修改失败，请稍后重试');
    }
}

// 处理退出登录
async function handleLogout() {
    const confirmed = await confirm('确定要退出登录吗？', '退出确认');
    if (confirmed) {
        localStorage.removeItem('token');
        token = null;
        currentUser = null;
        updateNavigation();
        navigateToPage('home');
    }
}

// 切换标签
function switchTab(tab) {
    // 更新标签按钮状态
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-tab') === tab) {
            btn.classList.add('active');
        }
    });
    
    // 更新内容显示
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    document.getElementById(`${tab}-form-container`).classList.add('active');
}

// 更新导航
function updateNavigation() {
    const userMenu = document.getElementById('user-menu');
    
    if (currentUser) {
        const avatarHtml = currentUser.avatar 
            ? `<img src="${currentUser.avatar}" style="width: 22px; height: 22px; border-radius: 50%; object-fit: cover; vertical-align: middle; margin-right: 4px;">`
            : '👤 ';
        userMenu.innerHTML = `
            <a href="#" data-page="profile" class="nav-link">${avatarHtml}${currentUser.display_name || currentUser.username}</a>
            <a href="#" onclick="handleLogout()" class="nav-link">退出</a>
        `;
        
        // 重新绑定事件
        userMenu.querySelector('[data-page="profile"]').addEventListener('click', (e) => {
            e.preventDefault();
            navigateToPage('profile');
        });
        
        // 显示通知铃铛并开始轮询
        toggleNotificationBell();
        startNotificationPolling();
    } else {
        userMenu.innerHTML = '<a href="#" data-page="login" class="nav-link" id="login-link">登录</a>';
        userMenu.querySelector('[data-page="login"]').addEventListener('click', (e) => {
            e.preventDefault();
            navigateToPage('login');
        });
        
        // 隐藏通知铃铛并停止轮询
        toggleNotificationBell();
        if (notificationPollingTimer) {
            clearInterval(notificationPollingTimer);
            notificationPollingTimer = null;
        }
    }
}

// 更新管理员功能
function updateAdminFeatures() {
    const addModpackBtn = document.getElementById('add-modpack-btn');
    const addMemberBtn = document.getElementById('add-member-btn');
    const galleryUploadBtn = document.getElementById('gallery-upload-btn');
    const galleryApplyBtn = document.getElementById('gallery-apply-btn');
    
    if (currentUser) {
        // 所有登录用户都可以添加整合包
        addModpackBtn.style.display = 'block';
        
        // 珍宝阁：管理员显示上传按钮，普通用户显示申请按钮
        if (currentUser.role === 'admin') {
            galleryUploadBtn.style.display = 'inline-block';
            galleryApplyBtn.style.display = 'none';
        } else {
            galleryUploadBtn.style.display = 'none';
            galleryApplyBtn.style.display = 'inline-block';
        }
        // 显示按钮后立即绑定事件
        bindGalleryButtons();
        
        // 只有管理员可以管理成员和查看审核
        if (currentUser.role === 'admin') {
            addMemberBtn.style.display = 'block';
            
            // 添加审核链接到导航栏
            const userMenu = document.getElementById('user-menu');
            const reviewLink = document.getElementById('review-link');
            if (!reviewLink) {
                const newLink = document.createElement('li');
                newLink.innerHTML = '<a href="#" data-page="review" class="nav-link" id="review-link">审核</a>';
                userMenu.parentElement.insertBefore(newLink, userMenu);
                
                // 添加点击事件
                newLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    navigateToPage('review');
                });
            }
        } else {
            addMemberBtn.style.display = 'none';
        }
    } else {
        addModpackBtn.style.display = 'none';
        addMemberBtn.style.display = 'none';
        if (galleryUploadBtn) galleryUploadBtn.style.display = 'none';
        if (galleryApplyBtn) galleryApplyBtn.style.display = 'none';
    }
}

// 加载审核页面（管理员）
async function loadReviewPage() {
    if (!currentUser || currentUser.role !== 'admin') {
        showError('需要管理员权限');
        navigateToPage('home');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/admin/pending-modpacks`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const pendingModpacks = await response.json();
            displayPendingModpacks(pendingModpacks);
        } else {
            showError('加载待审核整合包失败');
        }
    } catch (error) {
        console.error('加载审核列表失败:', error);
        showError('加载审核列表失败');
    }

    // 加载珍宝阁申请
    try {
        const res = await fetch(`${API_BASE}/gallery/admin/applications`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const apps = await res.json();
            displayGalleryApplications(apps);
        }
    } catch (e) {
        console.error('加载珍宝阁申请失败:', e);
    }
}

// 显示待审核整合包
function displayPendingModpacks(pendingModpacks) {
    const container = document.getElementById('pending-modpacks');
    container.innerHTML = '';
    
    if (pendingModpacks.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 40px;">暂无待审核的整合包</p>';
        return;
    }
    
    pendingModpacks.forEach(modpack => {
        const item = createPendingModpackItem(modpack);
        container.appendChild(item);
    });
}

// 创建待审核整合包项
function createPendingModpackItem(modpack) {
    const item = document.createElement('div');
    item.className = 'pending-item';
    
    const time = new Date(modpack.created_at).toLocaleString('zh-CN');
    
    item.innerHTML = `
        <div class="pending-header">
            <div>
                <div class="pending-title">${modpack.name}</div>
                <div class="pending-author">提交者：${modpack.author_name || '未知'} | ${time}</div>
            </div>
        </div>
        <div class="pending-content">
            <div class="pending-description">${modpack.description}</div>
            ${modpack.download_link ? `<div class="pending-link">下载链接：${modpack.download_link}</div>` : ''}
        </div>
        <div class="pending-actions">
            <button class="btn btn-primary" onclick="approveModpack(${modpack.id})">批准</button>
            <button class="btn btn-danger" onclick="rejectModpack(${modpack.id})">拒绝</button>
        </div>
    `;
    
    return item;
}

// 批准整合包
async function approveModpack(modpackId) {
    const confirmed = await confirm('确定要批准这个整合包吗？批准后将显示在首页。', '批准确认');
    if (!confirmed) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/admin/pending-modpacks/${modpackId}/approve`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showError('整合包已批准发布！');
            loadReviewPage();
            loadHomePage();
        } else {
            showError(data.error || '操作失败');
        }
    } catch (error) {
        console.error('批准整合包失败:', error);
        showError('操作失败');
    }
}

// 拒绝整合包
async function rejectModpack(modpackId) {
    const confirmed = await confirm('确定要拒绝这个整合包吗？拒绝后将被删除。', '拒绝确认');
    if (!confirmed) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/admin/pending-modpacks/${modpackId}/reject`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showError('整合包已拒绝并删除');
            loadReviewPage();
        } else {
            showError(data.error || '操作失败');
        }
    } catch (error) {
        console.error('拒绝整合包失败:', error);
        showError('操作失败');
    }
}

// 显示整合包详情面板
function showModpackDetail(modpack) {
    const overlay = document.getElementById('modpack-detail-overlay');
    const panel = document.getElementById('modpack-detail-panel');
    
    // 填充整合包信息
    document.getElementById('panel-modpack-image').src = modpack.image_url || '/images/logo.png';
    document.getElementById('panel-modpack-title').textContent = modpack.name;
    document.getElementById('panel-modpack-description').textContent = modpack.description;
    document.getElementById('panel-modpack-author').textContent = `作者：${modpack.author_name || '未知'}`;
    document.getElementById('panel-modpack-downloads').textContent = `下载量：${modpack.downloads || 0}`;
    document.getElementById('panel-modpack-views').textContent = `浏览量：${modpack.views || 0}`;
    
    // 存储当前整合包ID
    panel.dataset.modpackId = modpack.id;
    
    // 加载评论
    loadModpackComments(modpack.id);
    
    // 显示面板
    overlay.style.display = 'block';
    panel.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// 隐藏整合包详情面板
function hideModpackDetail() {
    const overlay = document.getElementById('modpack-detail-overlay');
    const panel = document.getElementById('modpack-detail-panel');
    
    panel.classList.remove('active');
    document.body.style.overflow = 'auto';
    
    setTimeout(() => {
        overlay.style.display = 'none';
    }, 300);
}

// 加载整合包评论
async function loadModpackComments(modpackId) {
    const container = document.getElementById('comments-list');
    container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">加载评论中...</p>';
    
    try {
        const response = await fetch(`${API_BASE}/comments/modpack/${modpackId}`);
        
        if (response.ok) {
            const comments = await response.json();
            displayModpackComments(comments);
        } else {
            container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">加载评论失败</p>';
        }
    } catch (error) {
        console.error('加载评论失败:', error);
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">加载评论失败</p>';
    }
}

// 显示整合包评论列表（支持回复嵌套）
function displayModpackComments(comments) {
    const container = document.getElementById('comments-list');
    container.innerHTML = '';
    
    if (comments.length === 0) {
        container.innerHTML = '<p class="no-comments">暂无评论，快来发表第一条评论吧！</p>';
        return;
    }
    
    const modpackId = document.getElementById('modpack-detail-panel').dataset.modpackId;
    // 只渲染顶层评论，回复默认折叠
    comments.forEach(comment => {
        container.innerHTML += renderModpackComment(comment, modpackId);
    });
}

// 渲染整合包单条评论（递归渲染子回复）
function renderModpackComment(comment, modpackId, isReply = false) {
    const marginLeft = isReply ? 'margin-left: 40px;' : '';
    const hasReplies = comment.replies && comment.replies.length > 0;
    const replyCount = hasReplies ? comment.replies.length : 0;
    
    return `
        <div class="comment-item" data-comment-id="${comment.id}" style="${marginLeft}">
            <div class="comment-header">
                <img src="${comment.avatar || '/images/default-avatar.svg'}" alt="${comment.username}" class="comment-avatar">
                <div class="comment-info">
                    <span class="comment-author">${comment.username}</span>
                    <span class="comment-time">${new Date(comment.created_at).toLocaleString('zh-CN')}</span>
                </div>
                ${currentUser ? `
                    <div style="margin-left: auto; display: flex; gap: 8px; align-items: center;">
                        <span style="color: var(--text-accent); cursor: pointer; font-size: 13px; opacity: 0.7; transition: opacity 0.2s;" 
                              onmouseover="this.style.opacity='1'" 
                              onmouseout="this.style.opacity='0.7'" 
                              onclick="showModpackReplyBox(${comment.id}, '${comment.username.replace(/'/g, "\\'")}')">
                            回复
                        </span>
                        ${currentUser && (currentUser.id === comment.user_id || currentUser.role === 'admin') ? `
                            <button class="btn btn-small btn-danger" onclick="deleteModpackComment(${comment.id}, ${modpackId})" style="padding: 2px 8px; font-size: 12px;">删除</button>
                        ` : ''}
                    </div>
                ` : ''}
            </div>
            <div class="comment-content">${comment.content}</div>
            <div id="modpack-reply-box-${comment.id}"></div>
            
            <!-- 折叠的回复 -->
            ${hasReplies ? `
                <div style="margin-top: 10px;">
                    <button class="btn-link" onclick="toggleModpackReplies(${comment.id})" id="toggle-modpack-replies-${comment.id}" style="color: var(--text-accent); font-size: 13px; opacity: 0.8; transition: opacity 0.2s; border: none; background: none; cursor: pointer;">
                        ↓ 展开 ${replyCount} 条回复
                    </button>
                    <div id="modpack-replies-${comment.id}" style="display: none; margin-top: 10px;">
                        ${comment.replies.map(reply => renderModpackComment(reply, modpackId, true)).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

// 展开/收起整合包评论回复
function toggleModpackReplies(commentId) {
    const container = document.getElementById(`modpack-replies-${commentId}`);
    const button = document.getElementById(`toggle-modpack-replies-${commentId}`);
    
    if (container.style.display === 'none') {
        container.style.display = 'block';
        button.textContent = button.textContent.replace('展开', '收起');
        button.innerHTML = button.innerHTML.replace('↓', '↑');
    } else {
        container.style.display = 'none';
        button.textContent = button.textContent.replace('收起', '展开');
        button.innerHTML = button.innerHTML.replace('↑', '↓');
    }
}

// 显示整合包评论回复输入框
function showModpackReplyBox(commentId, username) {
    const container = document.getElementById(`modpack-reply-box-${commentId}`);
    
    if (container.innerHTML) {
        container.innerHTML = '';
        return;
    }
    
    container.innerHTML = `
        <div style="margin-top: 10px; padding: 12px; border-radius: 8px; border: 1px solid var(--border-color);">
            <div style="color: var(--text-secondary); font-size: 13px; margin-bottom: 8px;">
                回复 <strong style="color: var(--text-accent);">@${username}</strong>
            </div>
            <textarea id="modpack-reply-content-${commentId}" class="comment-textarea" rows="2" placeholder="写下你的回复..." style="font-size: 14px; margin-bottom: 8px;"></textarea>
            <div style="display: flex; gap: 8px; justify-content: flex-end;">
                <button class="btn btn-small btn-secondary" onclick="document.getElementById('modpack-reply-box-${commentId}').innerHTML=''">取消</button>
                <button class="btn btn-small btn-primary" onclick="submitModpackCommentReply(${commentId})">发送</button>
            </div>
        </div>
    `;
    
    document.getElementById(`modpack-reply-content-${commentId}`).focus();
}

// 提交整合包评论回复
async function submitModpackCommentReply(parentId) {
    if (!currentUser) {
        showError('请先登录后再回复');
        navigateToPage('login');
        return;
    }
    
    const input = document.getElementById(`modpack-reply-content-${parentId}`);
    const content = input.value.trim();
    
    if (!content) {
        showError('回复内容不能为空');
        return;
    }
    
    const panel = document.getElementById('modpack-detail-panel');
    const modpackId = panel.dataset.modpackId;
    
    try {
        const response = await fetch(`${API_BASE}/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                modpackId: parseInt(modpackId),
                content: content,
                parent_id: parentId
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            await loadModpackComments(modpackId);
        } else {
            showError(data.error || '回复失败');
        }
    } catch (error) {
        console.error('提交回复失败:', error);
        showError('回复失败，请稍后重试');
    }
}

// 删除整合包评论
async function deleteModpackComment(commentId, modpackId) {
    const confirmed = await confirm('确定要删除这条评论吗？', '删除确认');
    if (!confirmed) return;
    
    try {
        const response = await fetch(`${API_BASE}/comments/${commentId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            showSuccessMessage('评论删除成功');
            loadModpackComments(modpackId);
        } else {
            const data = await response.json();
            showError(data.error || '删除失败');
        }
    } catch (error) {
        console.error('删除评论失败:', error);
        showError('删除失败');
    }
}

// 发表整合包评论
async function submitModpackComment() {
    if (!currentUser) {
        showError('请先登录后再发表评论');
        navigateToPage('login');
        return;
    }
    
    const panel = document.getElementById('modpack-detail-panel');
    const modpackId = panel.dataset.modpackId;
    const content = document.getElementById('comment-input').value.trim();
    
    if (!content) {
        showError('请输入评论内容');
        return;
    }
    
    if (content.length > 500) {
        showError('评论内容不能超过500字');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                modpackId: parseInt(modpackId),
                content: content
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            document.getElementById('comment-input').value = '';
            loadModpackComments(modpackId);
        } else {
            showError(data.error || '发表评论失败');
        }
    } catch (error) {
        console.error('发表评论失败:', error);
        showError('发表评论失败');
    }
}

// 初始化评论面板事件
function initCommentPanel() {
    const overlay = document.getElementById('modpack-detail-overlay');
    const panel = document.getElementById('modpack-detail-panel');
    const closeBtn = document.getElementById('panel-close-btn');
    const submitBtn = document.getElementById('comment-submit-btn');
    
    // 点击遮罩层关闭
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            hideModpackDetail();
        }
    });
    
    // 点击关闭按钮
    closeBtn.addEventListener('click', hideModpackDetail);
    
    // 提交评论
    submitBtn.addEventListener('click', submitModpackComment);
    
    // 回车键发表评论
    document.getElementById('comment-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submitModpackComment();
        }
    });
}

// ==================== AI聊天机器人 ====================
function initChatbot() {
    const toggle = document.getElementById('chatbot-toggle');
    const window = document.getElementById('chatbot-window');
    const close = document.getElementById('chatbot-close');
    const send = document.getElementById('chatbot-send');
    const input = document.getElementById('chatbot-input');
    
    // 切换聊天窗口
    toggle.addEventListener('click', () => {
        window.classList.toggle('active');
        if (window.classList.contains('active')) {
            input.focus();
        }
    });
    
    // 关闭聊天窗口
    close.addEventListener('click', () => {
        window.classList.remove('active');
    });
    
    // 发送消息
    send.addEventListener('click', sendChatMessage);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            sendChatMessage();
        }
    });
}

// 发送聊天消息
async function sendChatMessage() {
    const input = document.getElementById('chatbot-input');
    const message = input.value.trim();
    
    if (!message) return;
    
    // 显示用户消息
    addChatMessage(message, 'user');
    input.value = '';
    
    // 直接调用后端API，由后端统一处理预设问答和AI回复
    try {
        const response = await fetch(`${API_BASE}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            addChatMessage(data.reply, 'bot');
        } else {
            addChatMessage('抱歉，我现在有点问题，请稍后再试。', 'bot');
        }
    } catch (error) {
        console.error('聊天失败:', error);
        addChatMessage('抱歉，我现在有点问题，请稍后再试。', 'bot');
    }
}

// 添加聊天消息
function addChatMessage(text, sender) {
    const container = document.getElementById('chatbot-messages');
    const message = document.createElement('div');
    message.className = `message ${sender}`;
    message.textContent = text;
    container.appendChild(message);
    container.scrollTop = container.scrollHeight;
}

// ==================== 背景音乐 ====================

// 播放背景音乐
function playBackgroundMusic() {
    // 背景音乐控制已在 initMusicControl 中处理
    // 此函数保留用于兼容性
}

// ==================== 居中确认对话框 ====================

// 替换原生的confirm函数
window.originalConfirm = window.confirm;

window.confirm = function(message, title = '确认操作') {
    return new Promise((resolve) => {
        const modal = document.getElementById('center-confirm-modal');
        const titleEl = document.getElementById('confirm-title');
        const messageEl = document.getElementById('confirm-message');
        const yesBtn = document.getElementById('confirm-yes');
        const noBtn = document.getElementById('confirm-no');
        
        titleEl.textContent = title;
        messageEl.textContent = message;
        modal.classList.add('active');
        
        // 确定按钮
        yesBtn.onclick = () => {
            modal.classList.remove('active');
            resolve(true);
        };
        
        // 取消按钮
        noBtn.onclick = () => {
            modal.classList.remove('active');
            resolve(false);
        };
        
        // ESC键取消
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                modal.classList.remove('active');
                document.removeEventListener('keydown', escHandler);
                resolve(false);
            }
        };
        document.addEventListener('keydown', escHandler);
    });
}

// 加载野史趣事页面
let currentStoryPage = 1;
let currentStoryCategory = 'all';
let currentStorySort = 'latest';
let currentStorySearch = '';

async function loadStoriesPage() {
    try {
        // 构建请求URL
        const params = new URLSearchParams({
            page: currentStoryPage,
            limit: 10,
            category: currentStoryCategory,
            sort: currentStorySort
        });
        
        if (currentStorySearch) {
            params.append('search', currentStorySearch);
        }
        
        const response = await fetch(`${API_BASE}/stories?${params.toString()}`);
        if (!response.ok) {
            throw new Error('加载失败');
        }
        
        const data = await response.json();
        displayStories(data.stories);
        displayStoryPagination(data.pagination);
        
        // 显示/隐藏发布按钮
        const addBtn = document.getElementById('add-story-btn');
        if (currentUser) {
            addBtn.style.display = 'inline-block';
        } else {
            addBtn.style.display = 'none';
        }
        
    } catch (error) {
        console.error('加载野史趣事失败:', error);
        document.getElementById('stories-list').innerHTML = 
            '<p style="text-align: center; color: #ff6b6b; padding: 40px;">加载失败，请稍后重试</p>';
    }
    
    updateStoryForm();
}

// 筛选条件变化
function onStoryFilterChange() {
    currentStoryCategory = document.getElementById('story-category').value;
    currentStorySort = document.getElementById('story-sort').value;
    currentStoryPage = 1; // 重置到第一页
    loadStoriesPage();
}

// 搜索
function onStorySearch() {
    currentStorySearch = document.getElementById('story-search').value.trim();
    currentStoryPage = 1; // 重置到第一页
    loadStoriesPage();
}

// 切换文章页面
function changeStoryPage(direction) {
    currentStoryPage += direction;
    if (currentStoryPage < 1) currentStoryPage = 1;
    loadStoriesPage();
}

// 显示文章分页控件
function displayStoryPagination(pagination) {
    const { page, pages } = pagination;
    
    // 创建或更新分页控件
    let paginationEl = document.getElementById('story-pagination');
    if (!paginationEl) {
        const storiesPage = document.getElementById('stories-page');
        storiesPage.insertAdjacentHTML('beforeend', `
            <div class="pagination" id="story-pagination" style="margin-top: 30px; text-align: center;">
                <button class="btn btn-secondary" id="prev-page" onclick="changeStoryPage(-1)">上一页</button>
                <span style="margin: 0 20px;">第 ${page} 页 / 共 ${pages} 页</span>
                <button class="btn btn-secondary" id="next-page" onclick="changeStoryPage(1)">下一页</button>
            </div>
        `);
        paginationEl = document.getElementById('story-pagination');
    } else {
        // 更新现有分页信息
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');
        
        prevBtn.disabled = page <= 1;
        nextBtn.disabled = page >= pages;
        
        // 更新页码信息
        const pageInfo = paginationEl.querySelector('span');
        if (pageInfo) {
            pageInfo.textContent = `第 ${page} 页 / 共 ${pages} 页`;
        }
    }
}

// 显示野史趣事列表（仅显示标题，不显示图片、正文和按钮）
function displayStories(stories) {
    const container = document.getElementById('stories-list');
    container.innerHTML = '';
    
    if (stories.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 40px;">暂无野史趣事，快来发布第一条吧！</p>';
        return;
    }
    
    stories.forEach(story => {
        const storyEl = document.createElement('div');
        storyEl.className = 'story-item';
        
        const time = new Date(story.created_at).toLocaleString('zh-CN');
        const heat = story.heat || 0;
        const heatLevel = heat > 10 ? '🔥🔥🔥' : heat > 5 ? '🔥🔥' : heat > 0 ? '🔥' : '';
        
        storyEl.innerHTML = `
            <div class="story-header" style="cursor: pointer;" onclick="showStoryDetail(${story.id})">
                <h3 class="story-title" style="text-decoration: underline;">${story.title}</h3>
                <div class="story-meta">
                    <span class="story-author">👤 ${story.author_name}</span>
                    <span class="story-time">${time}</span>
                    <span class="story-views">👁️ ${story.views}次浏览</span>
                    <span class="story-likes">❤️ ${story.likes}个赞</span>
                    ${heatLevel ? `<span class="story-heat" title="热度值: ${heat}">${heatLevel}</span>` : ''}
                </div>
            </div>
        `;
        
        container.appendChild(storyEl);
    });
}

// 显示文章详情页面
async function showStoryDetail(storyId) {
    try {
        const response = await fetch(`${API_BASE}/stories/${storyId}`);
        if (!response.ok) {
            throw new Error('获取文章失败');
        }
        
        const story = await response.json();
        
        // 切换到详情视图
        const detailPage = document.getElementById('story-detail-page');
        detailPage.innerHTML = `
            <div class="story-detail-container">
                <div class="story-detail-header">
                    <button class="btn btn-secondary" onclick="backToStoriesList()">← 返回列表</button>
                    <h2>${story.title}</h2>
                    <div class="story-meta">
                        <span>👤 ${story.author_name}</span>
                        <span>📅 ${new Date(story.created_at).toLocaleString('zh-CN')}</span>
                        <span>👁️ ${story.views}次浏览</span>
                        <span>❤️ ${story.likes}个赞</span>
                    </div>
                </div>
                
                ${story.image_url ? `<img src="${story.image_url}" alt="${story.title}" class="story-detail-image">` : ''}
                
                <div class="story-detail-content">${story.content}</div>
                
                <div class="story-detail-actions">
                    <button class="btn btn-like" onclick="likeStory(${story.id})">👍 点赞 (${story.likes})</button>
                    <button class="btn btn-primary" onclick="scrollToComments()">💬 评论</button>
                    ${currentUser && (currentUser.id === story.author_id || currentUser.role === 'admin') ? `
                        <button class="btn btn-danger" onclick="deleteStory(${story.id})">🗑️ 删除文章</button>
                    ` : ''}
                </div>
                
                <div id="comments-section" class="comments-section" data-story-id="${story.id}">
                    <h3>💬 评论区</h3>
                    <div id="comments-list"></div>
                    <div id="comments-pagination"></div>
                    
                    ${currentUser ? `
                        <div class="comment-form">
                            <h4>发表评论</h4>
                            <div style="position: relative;">
                                <textarea id="comment-content" placeholder="写下你的评论...支持emoji和图片 📸" rows="4"></textarea>
                                <button type="button" id="story-emoji-btn" class="emoji-btn" title="插入表情">😊</button>
                            </div>
                            <div class="comment-form-actions">
                                <input type="file" id="comment-image" accept="image/*" style="display: none;">
                                <button type="button" class="btn btn-secondary" onclick="document.getElementById('comment-image').click()">📷 添加图片</button>
                                <div id="comment-image-preview" style="margin-top: 10px;"></div>
                                <button class="btn btn-primary" onclick="submitComment(${story.id})">发布评论</button>
                            </div>
                        </div>
                    ` : `
                        <p style="text-align: center; padding: 20px;">
                            请 <a href="#" onclick="navigateToPage('login'); return false;">登录</a> 后发表评论
                        </p>
                    `}
                </div>
            </div>
        `;
        
        // 切换到详情页（修复页面切换）
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById('story-detail-page').classList.add('active');
        
        // 添加浮动导航按钮（只在文章页显示）
        const floatingNav = document.createElement('div');
        floatingNav.className = 'floating-buttons article-nav';
        floatingNav.innerHTML = `
            <button class="floating-btn" onclick="window.scrollTo({top: 0, behavior: 'smooth'})" title="回到顶部">⬆️</button>
            <button class="floating-btn" onclick="scrollToComments()" title="前往评论">💬</button>
        `;
        document.body.appendChild(floatingNav);
        
        // 加载评论
        await loadComments(storyId);
        
        // 显示图片上传预览
        document.getElementById('comment-image').addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    document.getElementById('comment-image-preview').innerHTML = `
                        <img src="${e.target.result}" style="max-width: 200px; max-height: 200px; border-radius: 8px;">
                        <button type="button" class="btn btn-small btn-danger" onclick="clearCommentImage()" style="margin-left: 10px;">删除</button>
                    `;
                };
                reader.readAsDataURL(file);
            }
        });
        
    } catch (error) {
        console.error('显示文章详情失败:', error);
        showError('加载文章失败，请稍后重试');
    }
}

// 返回文章列表
function backToStoriesList() {
    // 清空详情页内容
    document.getElementById('story-detail-page').innerHTML = '';
    // 移除浮动导航按钮
    const floatingNav = document.querySelector('.floating-nav');
    if (floatingNav) {
        floatingNav.remove();
    }
    // 切换到文章列表页
    navigateToPage('stories');
}

// 滚动到评论区
function scrollToComments() {
    const commentsSection = document.getElementById('comments-section');
    if (commentsSection) {
        commentsSection.scrollIntoView({ behavior: 'smooth' });
    }
}

// 清除评论图片
function clearCommentImage() {
    document.getElementById('comment-image').value = '';
    document.getElementById('comment-image-preview').innerHTML = '';
}

// 更新发布按钮显示状态
function updateStoryForm() {
    const addBtn = document.getElementById('add-story-btn');
    
    if (currentUser) {
        addBtn.style.display = 'block';
        addBtn.onclick = () => showStoryModal();
    } else {
        addBtn.style.display = 'none';
    }
}

// 显示发布野史趣事模态框
function showStoryModal() {
    if (!currentUser) {
        showError('请先登录');
        navigateToPage('login');
        return;
    }
    
    const content = `
        <form id="story-form">
            <div class="form-group">
                <label for="story-title">标题 *</label>
                <input type="text" id="story-title" class="form-control" placeholder="给你的趣事起个标题..." required>
            </div>
            <div class="form-group">
                <label for="story-category-select">分类 *</label>
                <select id="story-category-select" class="form-control" style="padding: 12px; background-color: var(--primary-color); color: var(--text-primary); border: 2px solid var(--border-color); border-radius: 5px;">
                    <option value="gossip">八卦趣事</option>
                    <option value="novel">野史小说</option>
                </select>
            </div>
            <div class="form-group">
                <label for="story-content">内容 *</label>
                <textarea id="story-content" class="form-control" rows="8" placeholder="写下你的野史趣事、小道八卦或短篇小说...支持emoji表情 😄" required></textarea>
            </div>
            <div class="form-group">
                <label for="story-image">图片（可选）</label>
                <input type="file" id="story-image" class="form-control" accept="image/*">
            </div>
            <button type="submit" class="btn btn-primary">发布趣事</button>
            <button type="button" class="btn btn-secondary" onclick="hideModal()">取消</button>
        </form>
    `;
    
    showModal('发布野史趣事', content);
    
    // 绑定表单提交事件
    document.getElementById('story-form').addEventListener('submit', handleStorySubmit);
}

// 处理野史趣事提交
async function handleStorySubmit(e) {
    e.preventDefault();
    
    const title = document.getElementById('story-title').value.trim();
    const content = document.getElementById('story-content').value.trim();
    const category = document.getElementById('story-category-select').value;
    const imageFile = document.getElementById('story-image').files[0];
    
    if (!title || !content) {
        showError('标题和内容不能为空');
        return;
    }
    
    try {
        let imageUrl = null;
        
        // 如果有图片，先上传
        if (imageFile) {
            const formData = new FormData();
            formData.append('image', imageFile);
            
            const uploadRes = await fetch(`${API_BASE}/stories/upload-image`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });
            
            if (!uploadRes.ok) {
                throw new Error('图片上传失败');
            }
            
            const uploadData = await uploadRes.json();
            imageUrl = uploadData.imageUrl;
        }
        
        // 提交趣事
        const response = await fetch(`${API_BASE}/stories`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                title,
                content,
                category,
                image_url: imageUrl
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showSuccessMessage('发布成功！');
            hideModal();
            loadStoriesPage();
        } else {
            showError(data.error || '发布失败');
        }
    } catch (error) {
        console.error('发布失败:', error);
        showError('发布失败，请稍后重试');
    }
}

// 点赞野史趣事
async function likeStory(storyId) {
    if (!currentUser) {
        showError('请先登录');
        navigateToPage('login');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/stories/${storyId}/like`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // 更新点赞数显示
            const likeBtn = document.querySelector(`button[onclick="likeStory(${storyId})"]`);
            if (likeBtn) {
                likeBtn.innerHTML = `👍 点赞 (${data.likes})`;
            }
        } else {
            showError(data.error || '点赞失败');
        }
    } catch (error) {
        console.error('点赞失败:', error);
        showError('点赞失败');
    }
}

// 删除野史趣事
async function deleteStory(storyId) {
    const confirmed = await confirm('确定要删除这条趣事吗？', '删除确认');
    if (!confirmed) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/stories/${storyId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showSuccessMessage('删除成功');
            loadStoriesPage();
        } else {
            showError(data.error || '删除失败');
        }
    } catch (error) {
        console.error('删除失败:', error);
        showError('删除失败');
    }
}

// 加载评论（支持嵌套回复，支持分页）
let storyCommentCurrentPage = 1;

async function loadComments(storyId, page = 1) {
    try {
        const response = await fetch(`${API_BASE}/stories/${storyId}/comments?page=${page}&limit=10`);
        if (!response.ok) {
            throw new Error('获取评论失败');
        }
        
        const data = await response.json();
        const container = document.getElementById('comments-list');
        
        if (data.comments.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 20px;">暂无评论，快来发表第一条评论吧！</p>';
            document.getElementById('comments-pagination').innerHTML = '';
            return;
        }
        
        // 只渲染顶层评论，回复默认折叠
        container.innerHTML = data.comments.map(comment => renderComment(comment, storyId)).join('');
        
        // 渲染评论分页
        renderPagination('comments-pagination', data.pagination, 'comment');
    } catch (error) {
        console.error('加载评论失败:', error);
        document.getElementById('comments-list').innerHTML = '<p style="text-align: center; color: red;">加载评论失败</p>';
    }
}

// 切换评论页码
function changeCommentPage(direction) {
    const storyId = document.getElementById('comments-section')?.dataset.storyId;
    if (!storyId) return;
    
    const newPage = storyCommentCurrentPage + direction;
    if (newPage < 1) return;
    
    storyCommentCurrentPage = newPage;
    loadComments(storyId, newPage);
    // 滚动到评论区顶部
    document.getElementById('comments-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// 渲染单条评论（回复默认折叠）
function renderComment(comment, storyId, isReply = false) {
    const marginLeft = isReply ? 'margin-left: 40px;' : '';
    const hasReplies = comment.replies && comment.replies.length > 0;
    const replyCount = hasReplies ? comment.replies.length : 0;
    
    return `
        <div class="comment-item" data-comment-id="${comment.id}" style="${marginLeft}">
            <div class="comment-header">
                <img src="${comment.avatar || '/images/default-avatar.svg'}" alt="${comment.username}" class="comment-avatar">
                <div class="comment-info">
                    <span class="comment-author">${comment.username}</span>
                    <span class="comment-time">${new Date(comment.created_at).toLocaleString('zh-CN')}</span>
                    ${comment.role === 'admin' ? '<span class="admin-badge">管理员</span>' : ''}
                </div>
                ${currentUser ? `
                    <div style="margin-left: auto; display: flex; gap: 8px; align-items: center;">
                        <span style="color: var(--text-accent); cursor: pointer; font-size: 13px; opacity: 0.7; transition: opacity 0.2s;" 
                              onmouseover="this.style.opacity='1'" 
                              onmouseout="this.style.opacity='0.7'" 
                              onclick="showReplyBox(${comment.id}, '${comment.username.replace(/'/g, "\\'")}')">
                            回复
                        </span>
                        ${currentUser && (currentUser.id === comment.user_id || currentUser.role === 'admin') ? `
                            <button class="btn btn-small btn-danger" onclick="deleteComment(${storyId}, ${comment.id})" style="padding: 2px 8px; font-size: 12px;">删除</button>
                        ` : ''}
                    </div>
                ` : (currentUser && (currentUser.id === comment.user_id || currentUser.role === 'admin') ? `
                    <button class="btn btn-small btn-danger" onclick="deleteComment(${storyId}, ${comment.id})" style="margin-left: auto; padding: 2px 8px; font-size: 12px;">删除</button>
                ` : '')}
            </div>
            <div class="comment-content">${comment.content}</div>
            ${comment.image_url ? `<img src="${comment.image_url}" alt="评论图片" class="comment-image">` : ''}
            <div id="reply-box-${comment.id}"></div>
            
            <!-- 折叠的回复 -->
            ${hasReplies ? `
                <div style="margin-top: 10px;">
                    <button class="btn-link" onclick="toggleReplies(${comment.id})" id="toggle-replies-${comment.id}" style="color: var(--text-accent); font-size: 13px; opacity: 0.8; transition: opacity 0.2s; border: none; background: none; cursor: pointer;">
                        ↓ 展开 ${replyCount} 条回复
                    </button>
                    <div id="replies-${comment.id}" style="display: none; margin-top: 10px;">
                        ${comment.replies.map(reply => renderComment(reply, storyId, true)).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

// 展开/收起回复
function toggleReplies(commentId) {
    const container = document.getElementById(`replies-${commentId}`);
    const button = document.getElementById(`toggle-replies-${commentId}`);
    
    if (container.style.display === 'none') {
        container.style.display = 'block';
        button.textContent = button.textContent.replace('展开', '收起');
        button.innerHTML = button.innerHTML.replace('↓', '↑');
    } else {
        container.style.display = 'none';
        button.textContent = button.textContent.replace('收起', '展开');
        button.innerHTML = button.innerHTML.replace('↑', '↓');
    }
}

// 显示回复输入框（点击评论的"回复"文字弹出）
function showReplyBox(commentId, username) {
    const container = document.getElementById(`reply-box-${commentId}`);
    
    // 如果已经显示了，就收起
    if (container.innerHTML) {
        container.innerHTML = '';
        return;
    }
    
    container.innerHTML = `
        <div style="margin-top: 10px; padding: 12px; border-radius: 8px; border: 1px solid var(--border-color);">
            <div style="color: var(--text-secondary); font-size: 13px; margin-bottom: 8px;">
                回复 <strong style="color: var(--text-accent);">@${username}</strong>
            </div>
            <textarea id="reply-content-${commentId}" class="form-control" rows="2" placeholder="写下你的回复..." style="font-size: 14px;"></textarea>
            <div style="margin-top: 8px; display: flex; gap: 8px; justify-content: flex-end;">
                <button class="btn btn-small btn-secondary" onclick="document.getElementById('reply-box-${commentId}').innerHTML=''">取消</button>
                <button class="btn btn-small btn-primary" onclick="submitCommentReply(${commentId})">发送</button>
            </div>
        </div>
    `;
    
    // 自动聚焦
    document.getElementById(`reply-content-${commentId}`).focus();
}

// 提交评论回复
async function submitCommentReply(parentId) {
    if (!currentUser) {
        showError('请先登录后再回复');
        navigateToPage('login');
        return;
    }
    
    const input = document.getElementById(`reply-content-${parentId}`);
    const content = input.value.trim();
    
    if (!content) {
        showError('回复内容不能为空');
        return;
    }
    
    // 从当前页面获取storyId（story-detail-panel里隐藏了）
    const storyId = document.querySelector('[data-story-id]')?.dataset.storyId;
    if (!storyId) {
        showError('无法获取文章信息');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/stories/${storyId}/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                content: content,
                parent_id: parentId
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // 重新加载评论
            await loadComments(storyId);
            showSuccessMessage('回复成功！');
        } else {
            showError(data.error || '回复失败');
        }
    } catch (error) {
        console.error('提交回复失败:', error);
        showError('回复失败，请稍后重试');
    }
}

// 提交评论
async function submitComment(storyId) {
    const content = document.getElementById('comment-content').value.trim();
    const imageFile = document.getElementById('comment-image').files[0];
    
    if (!content && !imageFile) {
        showError('评论内容不能为空');
        return;
    }
    
    try {
        let imageUrl = null;
        
        // 如果有图片，先上传图片
        if (imageFile) {
            const formData = new FormData();
            formData.append('image', imageFile);
            
            const uploadResponse = await fetch(`${API_BASE}/stories/upload-image`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });
            
            if (!uploadResponse.ok) {
                throw new Error('图片上传失败');
            }
            
            const uploadData = await uploadResponse.json();
            imageUrl = uploadData.imageUrl;
        }
        
        // 提交评论
        const response = await fetch(`${API_BASE}/stories/${storyId}/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                content: content,
                image_url: imageUrl
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // 清空表单
            document.getElementById('comment-content').value = '';
            document.getElementById('comment-image').value = '';
            document.getElementById('comment-image-preview').innerHTML = '';
            
            // 重新加载评论
            await loadComments(storyId);
            showSuccessMessage('评论发布成功！');
        } else {
            showError(data.error || '评论发布失败');
        }
    } catch (error) {
        console.error('提交评论失败:', error);
        showError('评论发布失败');
    }
}

// 删除评论
async function deleteComment(storyId, commentId) {
    const confirmed = await confirm('确定要删除这条评论吗？', '删除确认');
    if (!confirmed) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/stories/${storyId}/comments/${commentId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showSuccessMessage('删除成功');
            loadComments(storyId);
        } else {
            showError(data.error || '删除失败');
        }
    } catch (error) {
        console.error('删除评论失败:', error);
        showError('删除失败');
    }
}

// ==================== 通知系统 ====================

let notificationPollingTimer = null;

// 显示通知下拉列表
function showNotifications(event) {
    event.preventDefault();
    event.stopPropagation();
    const dropdown = document.getElementById('notification-dropdown');
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    
    if (dropdown.style.display === 'block') {
        loadNotifications();
    }
}

// 加载通知列表
async function loadNotifications() {
    try {
        const response = await fetch(`${API_BASE}/notifications`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const notifications = await response.json();
            displayNotifications(notifications);
        }
    } catch (error) {
        console.error('加载通知失败:', error);
    }
}

// 通知类型图标映射
function getNotificationIcon(type) {
    const icons = {
        'like': '❤️',
        'comment': '💬',
        'comment_reply': '↩️',
        'modpack_approved': '✅',
        'modpack_rejected': '❌',
        'gallery_approved': '💎',
        'gallery_rejected': '🚫',
        'admin': '👑'
    };
    return icons[type] || '📢';
}

// 通知类型动作文案
function getNotificationAction(type) {
    const actions = {
        'like': '赞了',
        'comment': '评论了',
        'comment_reply': '回复了',
        'modpack_approved': '你的整合包审核通过了',
        'modpack_rejected': '你的整合包审核未通过',
        'admin': ''
    };
    return actions[type] || '';
}

// 根据通知类型和时间格式化显示文本
function getNotificationTimeText(n) {
    const now = new Date();
    const created = new Date(n.created_at);
    const diff = now - created;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    return created.toLocaleString('zh-CN', { month: 'short', day: 'numeric' });
}

// 点击通知时跳转到对应页面
function handleNotificationClick(notification) {
    var dropdown = document.getElementById('notification-dropdown');
    if (dropdown) dropdown.style.display = 'none';

    var type = notification.related_type;
    var relatedId = notification.related_id;
    var sourceId = notification.source_id || relatedId;

    if (type === 'story' && sourceId) {
        showStoryDetail(sourceId);
    } else if (type === 'story_comment' && sourceId) {
        showStoryDetail(sourceId).then(function() {
            setTimeout(function() { scrollToCommentById(relatedId); }, 500);
        });
    } else if (type === 'modpack_comment' && sourceId) {
        navigateToPage('home');
        setTimeout(function() {
            fetch(API_BASE + '/modpacks').then(function(r) { return r.json(); }).then(function(modpacks) {
                var modpack = modpacks.find(function(m) { return m.id === sourceId; });
                if (modpack) {
                    showModpackDetail(modpack);
                    setTimeout(function() { scrollToCommentById(relatedId); }, 500);
                }
            });
        }, 300);
    }

    markNotificationRead(notification.id);
}

// 滚动到指定评论（高亮显示）
function scrollToCommentById(commentId) {
    // 先展开所有被折叠的回复容器
    document.querySelectorAll('[id^="replies-"], [id^="modpack-replies-"]').forEach(function(el) {
        el.style.display = 'block';
    });
    document.querySelectorAll('[id^="toggle-replies-"], [id^="toggle-modpack-replies-"]').forEach(function(btn) {
        btn.textContent = btn.textContent.replace('展开', '收起');
        btn.innerHTML = btn.innerHTML.replace(/↓/g, '↑');
    });

    // 等展开后再查找并滚动
    setTimeout(function() {
        var commentEl = document.querySelector('[data-comment-id="' + commentId + '"]');
        if (commentEl) {
            commentEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            commentEl.style.transition = 'background-color 0.3s';
            commentEl.style.backgroundColor = 'rgba(59, 130, 246, 0.25)';
            setTimeout(function() {
                commentEl.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
            }, 1500);
            setTimeout(function() {
                commentEl.style.backgroundColor = '';
            }, 3000);
        } else {
            var commentsSection = document.getElementById('comments-section');
            if (commentsSection) {
                commentsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    }, 200);
}

// 从通知 content 中提取发送者名字（兼容 sender_id 为空的旧通知）
function extractSenderFromContent(n) {
    if (n.sender_display_name || n.sender_username) return null;
    const content = n.content || '';
    const match = content.match(/^(.+?)[\s](赞了|评论了|回复了)/);
    return match ? match[1] : null;
}

// 根据通知信息异步获取发送者完整信息（头像+名字，兼容旧通知）
const senderInfoCache = {};
async function getSenderInfo(n) {
    const hasSender = !!(n.sender_display_name || n.sender_username);
    if (hasSender) {
        return {
            name: n.sender_display_name || n.sender_username,
            avatar: n.sender_avatar || '/images/default-avatar.svg'
        };
    }
    
    const key = 'si_' + (n.sender_id || '') + '_' + n.related_type + '_' + n.related_id;
    if (senderInfoCache[key]) return senderInfoCache[key];
    
    const relatedType = n.related_type;
    const relatedId = n.related_id;
    if (!relatedType || !relatedId) return { name: extractSenderFromContent(n) || '未知用户', avatar: '/images/default-avatar.svg' };
    
    let apiUrl = null;
    if (relatedType === 'story_comment') {
        apiUrl = `${API_BASE}/comments/story/${relatedId}/sender`;
    } else if (relatedType === 'modpack_comment') {
        apiUrl = `${API_BASE}/comments/modpack/${relatedId}/sender`;
    }
    
    if (!apiUrl) return { name: extractSenderFromContent(n) || '未知用户', avatar: '/images/default-avatar.svg' };
    
    try {
        const resp = await fetch(apiUrl, { headers: { 'Authorization': `Bearer ${token}` } });
        if (resp.ok) {
            const data = await resp.json();
            if (data) {
                const info = {
                    name: data.display_name || data.username || extractSenderFromContent(n) || '未知用户',
                    avatar: data.avatar || '/images/default-avatar.svg'
                };
                senderInfoCache[key] = info;
                return info;
            }
        }
    } catch (e) {}
    
    return { name: extractSenderFromContent(n) || '未知用户', avatar: '/images/default-avatar.svg' };
}

// 显示通知列表
async function displayNotifications(notifications) {
    const container = document.getElementById('notification-list');
    if (notifications.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 20px;">暂无通知</p>';
        return;
    }
    
    // 先获取所有缺失的发送者信息
    const senderPromises = notifications.map(n => getSenderInfo(n));
    const senders = await Promise.all(senderPromises);
    
    container.innerHTML = notifications.map((n, i) => {
        const sender = senders[i];
        const senderName = sender.name;
        const senderAvatar = sender.avatar;
        const icon = getNotificationIcon(n.type);
        const action = getNotificationAction(n.type);
        const sourceTitle = n.source_title ? n.source_title : '';
        const timeText = getNotificationTimeText(n);
        const hasSender = senderName && senderName !== '未知用户';
        
        // 管理员/系统通知没有发送者头像
        const isSystem = n.type === 'modpack_approved' || n.type === 'modpack_rejected' || n.type === 'admin' || !hasSender;
        
        return `
        <div class="notification-item" style="padding: 12px 14px; border-bottom: 1px solid var(--border-color); cursor: pointer; background: ${n.is_read ? 'transparent' : 'rgba(59, 130, 246, 0.06)'}; border-radius: 8px; margin-bottom: 4px; transition: background 0.2s;" onclick="handleNotificationClick(${JSON.stringify(n).replace(/"/g, '&quot;')})" onmouseover="this.style.background='rgba(59,130,246,0.12)'" onmouseout="this.style.background='${n.is_read ? 'transparent' : 'rgba(59,130,246,0.06)'}'">
            <div style="display: flex; gap: 12px; align-items: flex-start;">
                ${isSystem ? `
                <div style="width: 42px; height: 42px; border-radius: 50%; background: linear-gradient(135deg, #f59e0b, #ef4444); display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 20px; box-shadow: 0 2px 8px rgba(245,158,11,0.3);">${icon}</div>
                ` : `
                <img src="${senderAvatar}" style="width: 42px; height: 42px; border-radius: 50%; object-fit: cover; flex-shrink: 0; border: 2px solid rgba(255,255,255,0.15); box-shadow: 0 2px 8px rgba(0,0,0,0.3);" onerror="this.onerror=null;this.src='/images/default-avatar.svg'">
                `}
                <div style="flex: 1; min-width: 0;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
                        <div style="display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0;">
                            ${!isSystem ? `<span style="color: #f0f0f0; font-weight: 700; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-shadow: 0 1px 3px rgba(0,0,0,0.3);">${senderName}</span>` : ''}
                            ${!isSystem ? `<span style="color: var(--text-secondary); font-size: 13px; white-space: nowrap;">${icon} ${action}</span>` : ''}
                            ${isSystem ? `<span style="color: #f59e0b; font-weight: 600; font-size: 14px;">${n.title}</span>` : ''}
                        </div>
                        ${n.is_read ? '' : '<span style="width: 8px; height: 8px; background: #3b82f6; border-radius: 50%; display: inline-block; flex-shrink: 0; margin-left: 6px; margin-top: 5px; box-shadow: 0 0 6px rgba(59,130,246,0.5);"></span>'}
                    </div>
                    ${!isSystem && n.content ? `<p style="color: var(--text-secondary); font-size: 12px; margin: 0 0 3px 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 1.5;">${n.content}</p>` : ''}
                    ${sourceTitle ? `<div style="color: var(--text-muted); font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 2px;">📌 ${sourceTitle}</div>` : ''}
                    <div style="color: var(--text-muted); font-size: 11px; opacity: 0.7;">${timeText}</div>
                </div>
            </div>
        </div>
    `;
    }).join('');
}

// 标记单条通知已读
async function markNotificationRead(notificationId) {
    try {
        await fetch(`${API_BASE}/notifications/${notificationId}/read`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        loadNotifications();
        updateNotificationBadge();
    } catch (error) {
        console.error('标记已读失败:', error);
    }
}

// 标记所有通知已读
async function markAllNotificationsRead(event) {
    if (event) event.preventDefault();
    if (event) event.stopPropagation();
    try {
        await fetch(`${API_BASE}/notifications/read-all`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        loadNotifications();
        updateNotificationBadge();
    } catch (error) {
        console.error('标记全部已读失败:', error);
    }
}

// 更新通知铃铛未读数量
async function updateNotificationBadge() {
    try {
        const response = await fetch(`${API_BASE}/notifications/unread-count`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const data = await response.json();
            const badge = document.getElementById('notification-badge');
            if (data.count > 0) {
                badge.textContent = data.count > 99 ? '99+' : data.count;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }
    } catch (error) {
        // 静默失败
    }
}

// 开始轮询未读通知
function startNotificationPolling() {
    if (notificationPollingTimer) clearInterval(notificationPollingTimer);
    updateNotificationBadge();
    notificationPollingTimer = setInterval(updateNotificationBadge, 30000); // 每30秒检查一次
}

// 显示/隐藏通知铃铛
function toggleNotificationBell() {
    const bell = document.getElementById('notification-bell');
    bell.style.display = currentUser ? 'block' : 'none';
}

// 点击页面其他区域关闭通知下拉
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('notification-dropdown');
    const bell = document.getElementById('notification-bell');
    if (dropdown && bell && !bell.contains(e.target)) {
        dropdown.style.display = 'none';
    }
});

// ==================== Emoji选择器 ====================

// Emoji列表
const emojiList = [
    '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃',
    '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '😋',
    '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐',
    '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😔',
    '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵',
    '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐', '😕',
    '😟', '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺', '😦', '😧',
    '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓',
    '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿', '💀',
    '☠️', '💩', '🤡', '👹', '👺', '👻', '👽', '👾', '🤖', '❤️',
    '🧡', '💛', '💚', '💙', '💜', '🤍', '🖤', '🤎', '💯', '💢'
];

// 初始化Emoji选择器
function initEmojiPicker() {
    const emojiPicker = document.getElementById('emoji-picker');
    const emojiGrid = document.getElementById('emoji-grid');
    
    if (!emojiPicker) return;
    
    let currentTextarea = null;
    let currentButton = null;
    
    // 渲染Emoji网格
    emojiGrid.innerHTML = '';
    emojiList.forEach(emoji => {
        const emojiItem = document.createElement('div');
        emojiItem.className = 'emoji-item';
        emojiItem.textContent = emoji;
        emojiItem.addEventListener('click', () => {
            if (currentTextarea) {
                insertEmoji(currentTextarea, emoji);
            }
            hideEmojiPicker();
        });
        emojiGrid.appendChild(emojiItem);
    });
    
    // 为所有emoji按钮添加事件监听
    function setupEmojiButtons() {
        // 整合包评论区emoji按钮
        const emojiBtn = document.getElementById('emoji-btn');
        if (emojiBtn) {
            emojiBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const commentForm = document.getElementById('comment-form');
                const textarea = document.getElementById('comment-input');
                toggleEmojiPicker(e.target, textarea, commentForm);
            });
        }
        
        // 野史趣事评论区emoji按钮
        const storyEmojiBtn = document.getElementById('story-emoji-btn');
        if (storyEmojiBtn) {
            storyEmojiBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const commentForm = e.target.closest('.comment-form');
                const textarea = document.getElementById('comment-content');
                toggleEmojiPicker(e.target, textarea, commentForm);
            });
        }
    }
    
    // 切换Emoji选择器显示/隐藏
    function toggleEmojiPicker(button, textarea, container) {
        if (currentButton === button && emojiPicker.style.display === 'block') {
            hideEmojiPicker();
        } else {
            currentTextarea = textarea;
            currentButton = button;
            showEmojiPicker(button, container);
        }
    }
    
    // 在textarea中插入Emoji
    function insertEmoji(textarea, emoji) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        
        textarea.value = text.substring(0, start) + emoji + text.substring(end);
        
        // 重新设置光标位置
        const newPos = start + emoji.length;
        textarea.setSelectionRange(newPos, newPos);
        
        // 聚焦到输入框
        textarea.focus();
    }
    
    // 点击其他地方关闭选择器
    document.addEventListener('click', (e) => {
        if (!emojiPicker.contains(e.target) && 
            (!currentButton || !currentButton.contains(e.target))) {
            hideEmojiPicker();
        }
    });
    
    // 初始设置
    setupEmojiButtons();
    
    // 定期检查和设置新出现的emoji按钮（适用于动态加载的内容）
    setInterval(setupEmojiButtons, 1000);
}

// 显示Emoji选择器
function showEmojiPicker(button, container) {
    const emojiPicker = document.getElementById('emoji-picker');
    
    // 将选择器移动到对应容器内
    container.style.position = 'relative';
    container.appendChild(emojiPicker);
    
    emojiPicker.style.display = 'block';
}

// 隐藏Emoji选择器
function hideEmojiPicker() {
    const emojiPicker = document.getElementById('emoji-picker');
    emojiPicker.style.display = 'none';
}

// 显示成功提示
// 居中弹窗提示（通用，替代所有 alert）
// type: 'success' | 'error' | 'warning'
function showSuccessMessage(message, type = 'success') {
    const toast = document.getElementById('success-toast');
    const messageEl = document.getElementById('success-message');
    const iconEl = document.getElementById('toast-icon');

    // 设置类型样式
    toast.className = 'success-toast';
    if (type === 'success') {
        toast.classList.add('toast-success');
        iconEl.textContent = '✓';
    } else if (type === 'error') {
        toast.classList.add('toast-error');
        iconEl.textContent = '✕';
    } else if (type === 'warning') {
        toast.classList.add('toast-warning');
        iconEl.textContent = '!';
    }

    messageEl.textContent = message;
    toast.classList.add('show');
}

// 便捷方法
function showError(message) {
    showSuccessMessage(message, 'error');
}

function showWarning(message) {
    showSuccessMessage(message, 'warning');
}

// 隐藏成功提示
function hideSuccessMessage() {
    const toast = document.getElementById('success-toast');
    toast.classList.remove('show');
}

// 点击成功提示外部关闭
document.addEventListener('click', (e) => {
    const toast = document.getElementById('success-toast');
    if (toast.classList.contains('show') && e.target === toast) {
        hideSuccessMessage();
    }
});

// 初始化所有功能
function initAllFeatures() {
    initCommentPanel();
    initChatbot();
    initEmojiPicker();
    playBackgroundMusic();
    toggleNotificationBell();
    if (currentUser) {
        startNotificationPolling();
    }
}

// 初始化时调用
initAllFeatures();

// 全局方法（供HTML调用）
window.app = {
    navigate: navigateToPage
};

// 显示免责条款
function showDisclaimer() {
    const modal = document.getElementById('disclaimer-modal');
    modal.classList.add('active');
}

// 隐藏免责条款
function hideDisclaimer() {
    const modal = document.getElementById('disclaimer-modal');
    modal.classList.remove('active');
}

// 主题列表
const themes = ['default', 'hell', 'end', 'ocean'];
let currentThemeIndex = 0;

// 切换主题
function toggleTheme() {
    const body = document.body;
    const themeIcon = document.getElementById('theme-icon');
    
    // 移除当前主题
    themes.forEach(theme => {
        body.classList.remove(`theme-${theme}`);
    });
    
    // 切换到下一个主题
    currentThemeIndex = (currentThemeIndex + 1) % themes.length;
    const nextTheme = themes[currentThemeIndex];
    
    if (nextTheme !== 'default') {
        body.classList.add(`theme-${nextTheme}`);
    }
    
    // 更新图标
    const icons = ['/images/slimeball.png', '/images/magma_cream.png', '/images/ender_eye.png', '/images/conduit.png'];
    themeIcon.src = icons[currentThemeIndex];
    
    // 保存主题偏好
    localStorage.setItem('theme', nextTheme);
    
    // 显示主题切换提示
    showThemeNotification(nextTheme);
}

// 显示主题切换提示
function showThemeNotification(theme) {
    const names = {
        'default': '默认',
        'hell': '下界',
        'end': '末地',
        'ocean': '海洋'
    };
    
    // 创建提示元素
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: var(--secondary-color);
        color: var(--text-accent);
        padding: 12px 20px;
        border-radius: 8px;
        border: 2px solid var(--border-color);
        z-index: 9999;
        font-weight: bold;
        box-shadow: var(--shadow-lg);
        transition: opacity 0.3s ease;
    `;
    notification.textContent = `已切换到${names[theme]}主题`;
    document.body.appendChild(notification);
    
    // 3秒后自动消失
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// 初始化主题
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'default';
    const themeIndex = themes.indexOf(savedTheme);
    if (themeIndex > 0) {
        currentThemeIndex = themeIndex - 1; // 减1因为toggleTheme会加1
        toggleTheme(); // 应用保存的主题
    }
    
    // 在页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initTheme();
        });
    } else {
        initTheme();
    }
}

// 初始化主题（放在DOM加载完成后）
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTheme);
} else {
    initTheme();
}

// 初始化粒子背景
function initParticles() {
    const canvas = document.getElementById('particle-canvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    let particles = [];
    let animationId;
    
    // 设置画布大小
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // 粒子类
    class Particle {
        constructor() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.vx = (Math.random() - 0.5) * 0.5;
            this.vy = (Math.random() - 0.5) * 0.5;
            this.size = Math.random() * 2 + 1;
            this.opacity = Math.random() * 0.5 + 0.2;
            this.color = ['#3b82f6', '#2563eb', '#60a5fa', '#FFD700'][Math.floor(Math.random() * 4)];
        }
        
        update() {
            this.x += this.vx;
            this.y += this.vy;
            
            // 边界检测
            if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
            if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
        }
        
        draw() {
            ctx.save();
            ctx.globalAlpha = this.opacity;
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }
    
    // 初始化粒子
    function initParticlesSystem() {
        particles = [];
        const particleCount = Math.min(100, Math.floor(canvas.width * canvas.height / 10000));
        for (let i = 0; i < particleCount; i++) {
            particles.push(new Particle());
        }
    }
    
    initParticlesSystem();
    
    // 动画循环
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        particles.forEach(particle => {
            particle.update();
            particle.draw();
        });
        
        // 连接附近的粒子
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < 100) {
                    ctx.save();
                    ctx.globalAlpha = (100 - distance) / 100 * 0.1;
                    ctx.strokeStyle = '#3b82f6';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.stroke();
                    ctx.restore();
                }
            }
        }
        
        animationId = requestAnimationFrame(animate);
    }
    
    // 只在首页激活时开始动画
    function checkHomePageActive() {
        const homePage = document.getElementById('home-page');
        if (homePage && homePage.classList.contains('active')) {
            if (!animationId) {
                animate();
            }
        } else {
            if (animationId) {
                cancelAnimationFrame(animationId);
                animationId = null;
            }
        }
    }
    
    // 监听页面切换
    const observer = new MutationObserver(checkHomePageActive);
    observer.observe(document.body, { attributes: true, subtree: true });
    
    // 初始检查
    checkHomePageActive();
}

// 初始化音乐控制
function initMusicControl() {
    const bgMusic = document.getElementById('bg-music');
    const musicBtn = document.getElementById('music-control-btn');
    
    if (!bgMusic || !musicBtn) {
        console.error('音乐控制元素未找到');
        return;
    }
    
    // 设置音量
    bgMusic.volume = 0.3;
    
    // 确保音频元素已加载
    bgMusic.load();
    
    // 延迟尝试自动播放，确保DOM完全加载
    setTimeout(() => {
        bgMusic.play().then(() => {
            console.log('背景音乐自动播放成功');
        }).catch(e => {
            console.log('自动播放失败（需要用户交互）:', e);
            // 如果自动播放失败，在用户首次点击页面时尝试播放
            const tryPlay = () => {
                bgMusic.play().then(() => {
                    console.log('背景音乐播放成功');
                }).catch(err => {
                    console.log('播放失败:', err);
                });
                document.removeEventListener('click', tryPlay);
            };
            document.addEventListener('click', tryPlay, { once: true });
        });
    }, 100);
    
    // 点击按钮切换播放/暂停
    musicBtn.addEventListener('click', (e) => {
        e.preventDefault(); // 防止默认行为
        if (bgMusic.paused) {
            bgMusic.play();
            musicBtn.classList.remove('paused');
            console.log('音乐继续播放');
        } else {
            bgMusic.pause();
            musicBtn.classList.add('paused');
            console.log('音乐已暂停');
        }
    });
}

// 粒子背景系统
function initParticles() {
    const canvas = document.getElementById('particle-canvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    let particles = [];
    let animationId;
    
    // 设置画布大小
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // 粒子类
    class Particle {
        constructor() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.vx = (Math.random() - 0.5) * 0.5;
            this.vy = (Math.random() - 0.5) * 0.5;
            this.size = Math.random() * 2 + 1;
            this.opacity = Math.random() * 0.5 + 0.2;
            this.color = ['#3b82f6', '#2563eb', '#60a5fa', '#FFD700'][Math.floor(Math.random() * 4)];
        }
        
        update() {
            this.x += this.vx;
            this.y += this.vy;
            
            // 边界检测
            if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
            if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
        }
        
        draw() {
            ctx.save();
            ctx.globalAlpha = this.opacity;
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }
    
    // 初始化粒子
    function initParticles() {
        particles = [];
        const particleCount = Math.min(100, Math.floor(canvas.width * canvas.height / 10000));
        for (let i = 0; i < particleCount; i++) {
            particles.push(new Particle());
        }
    }
    
    initParticles();
    
    // 动画循环
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        particles.forEach(particle => {
            particle.update();
            particle.draw();
        });
        
        // 连接附近的粒子
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < 100) {
                    ctx.save();
                    ctx.globalAlpha = (100 - distance) / 100 * 0.1;
                    ctx.strokeStyle = '#3b82f6';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.stroke();
                    ctx.restore();
                }
            }
        }
        
        animationId = requestAnimationFrame(animate);
    }
    
    // 只在首页激活时开始动画
    function checkHomePageActive() {
        const homePage = document.getElementById('home-page');
        if (homePage && homePage.classList.contains('active')) {
            if (!animationId) {
                animate();
            }
        } else {
            if (animationId) {
                cancelAnimationFrame(animationId);
                animationId = null;
            }
        }
    }
    
    // 监听页面切换
    const observer = new MutationObserver(checkHomePageActive);
    observer.observe(document.body, { attributes: true, subtree: true });
    
    // 初始检查
    checkHomePageActive();
}

// ==================== 珍宝阁功能 ====================

let galleryCurrentPage = 1;
let galleryHasMore = true;
let galleryLoading = false;

// 加载珍宝阁页面
async function loadGalleryPage() {
    galleryCurrentPage = 1;
    galleryHasMore = true;
    document.getElementById('gallery-grid').innerHTML = '';
    document.getElementById('gallery-load-more').style.display = 'none';

    // 确保按钮可见且可点击
    updateAdminFeatures();

    await loadGalleryItems();
}

// 绑定珍宝阁按钮事件（使用 addEventListener，只在DOM中绑定一次）
let _galleryBtnsBound = false;
function bindGalleryButtons() {
    if (_galleryBtnsBound) return; // 已绑定过就不再重复
    _galleryBtnsBound = true;

    const uploadBtn = document.getElementById('gallery-upload-btn');
    const applyBtn = document.getElementById('gallery-apply-btn');
    
    console.log('珍宝阁按钮绑定:', { uploadBtn: !!uploadBtn, applyBtn: !!applyBtn, currentUser: !!currentUser });
    
    if (uploadBtn) {
        uploadBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('上传按钮被点击!');
            showGalleryUploadModal(false);
        }, true); // capture阶段捕获
        console.log('上传按钮事件已绑定');
    }
    
    if (applyBtn) {
        applyBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('申请按钮被点击!');
            showGalleryUploadModal(true);
        }, true); // capture阶段捕获
        console.log('申请按钮事件已绑定');
    }
}

// 加载珍宝阁列表
async function loadGalleryItems() {
    if (galleryLoading) return;
    galleryLoading = true;

    try {
        const response = await fetch(API_BASE + '/gallery?page=' + galleryCurrentPage + '&limit=12');
        if (!response.ok) throw new Error('加载失败');
        const data = await response.json();

        const grid = document.getElementById('gallery-grid');
        // 按ID去重，防止重复渲染
        const existingIds = new Set();
        grid.querySelectorAll('[data-gallery-id]').forEach(el => existingIds.add(el.dataset.galleryId));
        
        data.items.forEach(item => {
            if (existingIds.has(String(item.id))) return;
            grid.appendChild(createGalleryCard(item));
        });

        galleryHasMore = data.page < data.totalPages;
        document.getElementById('gallery-load-more').style.display = galleryHasMore ? 'block' : 'none';
    } catch (error) {
        console.error('加载珍宝阁失败:', error);
        document.getElementById('gallery-grid').innerHTML = '<p style="text-align:center;color:var(--text-secondary);grid-column:1/-1;padding:40px;">暂无内容，快来上传第一张照片吧</p>';
    } finally {
        galleryLoading = false;
    }
}

// 加载更多
async function loadMoreGallery() {
    galleryCurrentPage++;
    await loadGalleryItems();
}

// 创建照片卡片
function createGalleryCard(item) {
    const div = document.createElement('div');
    div.className = 'gallery-item';
    div.setAttribute('data-gallery-id', item.id);
    div.onclick = () => showGalleryDetail(item.id);

    const isVideo = item.file_type === 'video';
    const src = item.image_url || '/images/default-avatar.svg';
    const name = item.uploader_display || item.uploader_username || '匿名';
    const likes = item.likes || 0;
    const views = item.views || 0;

    if (isVideo) {
        div.innerHTML = '<div class="gallery-item-video"><video src="' + src + '" preload="metadata" muted></video><div class="gallery-item-play">▶</div></div>';
    } else {
        div.innerHTML = '<img src="' + src + '" class="gallery-item-img" alt="' + item.title + '" loading="lazy">';
    }
    div.innerHTML += '<div class="gallery-item-overlay"><div class="gallery-item-title">' + item.title + '</div><div class="gallery-item-meta"><span>📷 ' + name + '</span><span>❤️ ' + likes + '</span><span>👁️ ' + views + '</span></div></div>';

    return div;
}

// 显示详情（左图右评论）
async function showGalleryDetail(id) {
    navigateToPage('gallery-detail');
    const container = document.getElementById('gallery-detail-page');
    container.innerHTML = '<div style="text-align:center;padding:60px;color:var(--text-secondary);">加载中...</div>';

    try {
        const [itemRes, commentsRes] = await Promise.all([
            fetch(API_BASE + '/gallery/' + id),
            fetch(API_BASE + '/gallery/' + id + '/comments')
        ]);

        if (!itemRes.ok) throw new Error('内容不存在');
        const item = await itemRes.json();
        const comments = commentsRes.ok ? await commentsRes.json() : [];

        const isVideo = item.file_type === 'video';
        const uName = item.uploader_display || item.uploader_username || '匿名';
        const uAvatar = item.uploader_avatar || '/images/default-avatar.svg';
        const timeStr = new Date(item.created_at + 'Z').toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

        let mediaHtml = isVideo 
            ? '<video src="' + item.image_url + '" controls autoplay style="max-width:100%;max-height:75vh;"></video>'
            : '<img src="' + item.image_url + '" alt="' + item.title + '">';
        
        let adminBtn = '';
        if (currentUser && currentUser.role === 'admin') {
            adminBtn = '<button onclick="deleteGalleryItem(' + item.id + ')" class="btn btn-danger" style="padding:6px 14px;font-size:13px;float:right;">🗑️ 删除</button>';
        }

        let commentsHtml = comments.length === 0 
            ? '<p style="text-align:center;color:var(--text-muted);padding:20px;font-size:13px;">暂无评论，来说点什么吧</p>'
            : comments.map(c => renderGalleryComment(c, item.id)).join('');

        let commentFormHtml = '';
        if (currentUser) {
            commentFormHtml = '<div class="gallery-comment-input-wrap"><textarea id="gallery-comment-input" placeholder="写下你的评论..." rows="2"></textarea><div class="btn-row"><button onclick="submitGalleryComment(' + item.id + ')" class="btn btn-primary" style="padding:8px 20px;font-size:13px;">发表评论</button></div></div>';
        } else {
            commentFormHtml = '<p style="text-align:center;color:var(--text-muted);padding:12px;font-size:13px;border-top:1px solid var(--border-color);margin-top:12px;">登录后可以发表评论</p>';
        }

        let descHtml = item.description ? '<div class="gallery-detail-description">' + item.description + '</div>' : '';

        container.innerHTML = '<div class="gallery-detail-container">' +
            '<div class="gallery-detail-left">' +
            '<div style="margin-bottom:12px;"><button onclick="navigateToPage(\'gallery\')" class="btn btn-secondary" style="padding:6px 14px;font-size:13px;">← 返回珍宝阁</button>' + adminBtn + '</div>' +
            '<div class="gallery-detail-image-wrap">' + mediaHtml + '</div>' +
            '<div class="gallery-detail-info">' +
            '<div class="gallery-detail-title">' + item.title + '</div>' +
            descHtml +
            '<div class="gallery-detail-meta">' +
            '<img src="' + uAvatar + '" onerror="this.src=\'/images/default-avatar.svg\'">' +
            '<span>' + uName + '</span>' +
            '<span>📅 ' + timeStr + '</span>' +
            '<span>👁️ ' + item.views + '</span>' +
            '<span style="cursor:pointer;" onclick="likeGalleryItem(' + item.id + ', this)">❤️ <span>' + item.likes + '</span></span>' +
            '</div></div></div>' +
            '<div class="gallery-detail-right">' +
            '<div class="gallery-comments-header">💬 评论 (' + comments.length + ')</div>' +
            '<div class="gallery-comments-list" id="gallery-comments-list">' + commentsHtml + '</div>' +
            commentFormHtml +
            '</div></div>';

    } catch (error) {
        container.innerHTML = '<div style="text-align:center;padding:60px;color:#ff6b6b;">加载失败：' + error.message + '</div>';
    }
}

// 渲染评论
function renderGalleryComment(comment, galleryId) {
    const avatar = comment.avatar || '/images/default-avatar.svg';
    const name = comment.display_name || comment.username || '未知用户';
    const timeStr = new Date(comment.created_at + 'Z').toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const canDelete = currentUser && (currentUser.id === comment.user_id || currentUser.role === 'admin');
    const safeName = (name || '').replace(/'/g, "\\'");

    let actionsHtml = '';
    if (canDelete) actionsHtml += '<span class="gallery-comment-delete" onclick="deleteGalleryComment(' + galleryId + ',' + comment.id + ')">删除</span>';
    if (currentUser) actionsHtml += '<span class="gallery-comment-reply-trigger" onclick="toggleGalleryReply(' + comment.id + ',&#39;' + safeName + '&#39;)">回复</span>';

    let h = '<div class="gallery-comment-item" data-comment-id="' + comment.id + '">';
    h += '<div class="gallery-comment-header">';
    h += '<img src="' + avatar + '" class="gallery-comment-avatar" onerror="this.src=\'/images/default-avatar.svg\'">';
    h += '<span class="gallery-comment-name">' + name + '</span>';
    h += '<span class="gallery-comment-time">' + timeStr + '</span>';
    h += actionsHtml;
    h += '</div>';
    h += '<div class="gallery-comment-content">' + comment.content + '</div>';
    h += '<div id="gallery-reply-box-' + comment.id + '"></div>';
    h += '</div>';
    return h;
}

// 切换回复框
function toggleGalleryReply(commentId, replyToName) {
    const box = document.getElementById('gallery-reply-box-' + commentId);
    if (box.innerHTML) { box.innerHTML = ''; return; }
    const textareaId = 'gallery-reply-input-' + commentId;
    const boxId = 'gallery-reply-box-' + commentId;
    let h = '<div style="margin-top:8px;padding-left:4px;">';
    h += '<textarea id="' + textareaId + '" placeholder="回复 ' + replyToName + '..." rows="2" style="width:100%;min-height:40px;padding:8px;border:1px solid var(--border-color);border-radius:6px;background:var(--secondary-color);color:var(--text-primary);font-size:12px;resize:none;outline:none;font-family:inherit;box-sizing:border-box;"></textarea>';
    h += '<div style="display:flex;gap:6px;margin-top:6px;justify-content:flex-end;">';
    h += '<button onclick="document.getElementById(\'' + boxId + '\').innerHTML=\'\'" class="btn btn-secondary" style="padding:4px 12px;font-size:12px;">取消</button>';
    h += '<button onclick="submitGalleryReply(' + commentId + ')" class="btn btn-primary" style="padding:4px 12px;font-size:12px;">回复</button>';
    h += '</div></div>';
    box.innerHTML = h;
    document.getElementById(textareaId).focus();
}

// 提交评论
async function submitGalleryComment(galleryId) {
    const input = document.getElementById('gallery-comment-input');
    const content = input.value.trim();
    if (!content) { showError('评论内容不能为空'); return; }

    try {
        const formData = new FormData();
        formData.append('content', content);
        const response = await fetch(API_BASE + '/gallery/' + galleryId + '/comments', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token },
            body: formData
        });
        if (response.ok) {
            input.value = '';
            showSuccessMessage('评论发表成功');
            showGalleryDetail(galleryId);
        } else {
            const data = await response.json();
            showError(data.error || '评论失败');
        }
    } catch (error) { showError('评论失败'); }
}

// 提交回复
async function submitGalleryReply(parentId) {
    const input = document.getElementById('gallery-reply-input-' + parentId);
    if (!input) return;
    const content = input.value.trim();
    if (!content) { showError('回复内容不能为空'); return; }

    const pageHtml = document.getElementById('gallery-detail-page').innerHTML;
    const match = pageHtml.match(/submitGalleryComment\((\d+)\)/);
    const galleryId = match ? parseInt(match[1]) : null;
    if (!galleryId) { showError('操作失败'); return; }

    try {
        const formData = new FormData();
        formData.append('content', content);
        formData.append('parent_id', parentId);
        const response = await fetch(API_BASE + '/gallery/' + galleryId + '/comments', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token },
            body: formData
        });
        if (response.ok) {
            showSuccessMessage('回复成功');
            showGalleryDetail(galleryId);
        } else {
            const data = await response.json();
            showError(data.error || '回复失败');
        }
    } catch (error) { showError('回复失败'); }
}

// 删除评论
async function deleteGalleryComment(galleryId, commentId) {
    if (!confirm('确定删除这条评论吗？')) return;
    try {
        const response = await fetch(API_BASE + '/gallery/' + galleryId + '/comments/' + commentId, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (response.ok) { showSuccessMessage('评论已删除'); showGalleryDetail(galleryId); }
        else showError('删除失败');
    } catch (error) { showError('删除失败'); }
}

// 点赞
async function likeGalleryItem(id, el) {
    try {
        const response = await fetch(API_BASE + '/gallery/' + id + '/like', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (response.ok) {
            const countEl = el.querySelector('span');
            countEl.textContent = parseInt(countEl.textContent) + 1;
            el.style.transform = 'scale(1.3)';
            setTimeout(() => el.style.transform = 'scale(1)', 200);
        }
    } catch (error) { showError('操作失败'); }
}

// 删除照片
async function deleteGalleryItem(id) {
    if (!confirm('确定删除这张照片吗？删除后不可恢复。')) return;
    try {
        const response = await fetch(API_BASE + '/gallery/' + id, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (response.ok) { showSuccessMessage('删除成功'); navigateToPage('gallery'); }
        else showError('删除失败');
    } catch (error) { showError('删除失败'); }
}

// 显示上传弹窗
function showGalleryUploadModal(isApply) {
    const existing = document.querySelector('.gallery-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'gallery-modal-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    const titleText = isApply ? '📤 申请上传照片' : '📷 上传照片/视频';
    const submitText = isApply ? '提交申请' : '上传';
    const desc = isApply ? '提交后需等待管理员审核通过才会展示' : '上传后直接展示在珍宝阁中';

    overlay.innerHTML = '<div class="gallery-modal">' +
        '<h3>' + titleText + '</h3>' +
        '<p style="color:var(--text-muted);font-size:13px;margin-bottom:16px;">' + desc + '</p>' +
        '<label>标题 *</label>' +
        '<input type="text" id="gallery-upload-title" placeholder="给照片取个名字" maxlength="200">' +
        '<label>介绍</label>' +
        '<textarea id="gallery-upload-desc" placeholder="写点关于这张照片的介绍..." rows="3"></textarea>' +
        '<label>选择文件 *</label>' +
        '<div class="gallery-file-upload" id="gallery-file-upload" onclick="document.getElementById(\'gallery-file-input\').click()">' +
        '<div style="font-size:36px;margin-bottom:8px;">📁</div>' +
        '<div style="color:var(--text-secondary);font-size:14px;">点击选择图片或视频</div>' +
        '<div style="color:var(--text-muted);font-size:12px;margin-top:4px;">支持 JPG/PNG/GIF/WebP/MP4，图片最大10MB，视频最大50MB</div>' +
        '</div>' +
        '<input type="file" id="gallery-file-input" accept="image/*,video/mp4,video/webm" style="display:none;" onchange="previewGalleryFile(this)">' +
        '<div class="gallery-modal-actions">' +
        '<button onclick="this.closest(\'.gallery-modal-overlay\').remove()" class="btn btn-secondary">取消</button>' +
        '<button onclick="submitGalleryUpload(' + isApply + ')" class="btn btn-primary">' + submitText + '</button>' +
        '</div></div>';

    document.body.appendChild(overlay);
}

// 文件预览
function previewGalleryFile(input) {
    const uploadArea = document.getElementById('gallery-file-upload');
    const file = input.files[0];
    if (!file) return;

    uploadArea.classList.add('has-file');
    const oldPreview = uploadArea.querySelector('.file-preview');
    if (oldPreview) oldPreview.remove();

    if (file.type.startsWith('image/')) {
        const img = document.createElement('img');
        img.className = 'file-preview';
        img.src = URL.createObjectURL(file);
        uploadArea.appendChild(img);
    } else if (file.type.startsWith('video/')) {
        const video = document.createElement('video');
        video.className = 'file-preview';
        video.src = URL.createObjectURL(file);
        video.controls = true;
        video.muted = true;
        video.style.maxHeight = '200px';
        uploadArea.appendChild(video);
    }

    uploadArea.querySelector('div:first-child').textContent = '✅';
    uploadArea.querySelector('div:nth-child(2)').textContent = file.name;
}

// 提交上传
async function submitGalleryUpload(isApply) {
    const title = document.getElementById('gallery-upload-title').value.trim();
    const description = document.getElementById('gallery-upload-desc').value.trim();
    const fileInputEl = document.getElementById('gallery-file-input');
    const file = fileInputEl ? fileInputEl.files[0] : null;

    if (!title) { showError('请填写标题'); return; }
    if (!file) { showError('请选择文件'); return; }

    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    formData.append('file', file);

    try {
        const url = isApply ? (API_BASE + '/gallery/apply') : (API_BASE + '/gallery');
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token },
            body: formData
        });
        const data = await response.json();
        if (response.ok) {
            showSuccessMessage(data.message || (isApply ? '申请已提交' : '上传成功'));
            document.querySelector('.gallery-modal-overlay').remove();
            if (!isApply) loadGalleryPage();
        } else {
            showError(data.error || '操作失败');
        }
    } catch (error) { showError('操作失败'); }
}

// 显示珍宝阁申请列表
function displayGalleryApplications(apps) {
    const container = document.getElementById('pending-gallery-applications');
    if (!container) return;
    container.innerHTML = '';

    if (!apps || apps.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:40px;">暂无珍宝阁上传申请</p>';
        return;
    }

    apps.forEach(app => {
        const item = document.createElement('div');
        item.className = 'pending-item';
        const userName = app.display_name || app.username || '未知用户';
        const userAvatar = app.avatar || '/images/default-avatar.svg';
        const time = new Date((app.created_at || '') + 'Z').toLocaleString('zh-CN');
        const isVideo = app.file_type === 'video';
        const mediaHtml = isVideo
            ? '<video src="' + app.image_url + '" style="max-width:200px;max-height:150px;border-radius:8px;" controls muted></video>'
            : '<img src="' + app.image_url + '" style="max-width:200px;max-height:150px;border-radius:8px;object-fit:cover;">';
        const statusBadge = app.status === 'pending' ? '<span style="color:#f59e0b;font-size:12px;">⏳ 待审核</span>'
            : app.status === 'approved' ? '<span style="color:#22c55e;font-size:12px;">✅ 已通过</span>'
            : '<span style="color:#ef4444;font-size:12px;">❌ 已拒绝</span>';

        item.innerHTML = '<div class="pending-header">' +
            '<div style="display:flex;align-items:center;gap:8px;">' +
            '<img src="' + userAvatar + '" style="width:28px;height:28px;border-radius:50%;object-fit:cover;" onerror="this.src=\'/images/default-avatar.svg\'">' +
            '<strong>' + userName + '</strong> 申请上传' + statusBadge +
            '</div>' +
            '<span style="font-size:12px;color:var(--text-muted);">' + time + '</span>' +
            '</div>' +
            '<div style="display:flex;gap:16px;align-items:flex-start;margin:12px 0;">' +
            '<div>' + mediaHtml + '</div>' +
            '<div style="flex:1;">' +
            '<div style="font-weight:600;margin-bottom:4px;">' + app.title + '</div>' +
            (app.description ? '<div style="color:var(--text-secondary);font-size:13px;">' + app.description + '</div>' : '') +
            '</div></div>' +
            (app.status === 'pending' ?
            '<div style="display:flex;gap:8px;justify-content:flex-end;">' +
            '<button onclick="rejectGalleryApp(' + app.id + ')" class="btn btn-danger" style="padding:6px 16px;font-size:13px;">拒绝</button>' +
            '<button onclick="approveGalleryApp(' + app.id + ')" class="btn btn-primary" style="padding:6px 16px;font-size:13px;">通过</button>' +
            '</div>' : '');

        container.appendChild(item);
    });
}

// 审核通过
async function approveGalleryApp(id) {
    try {
        const res = await fetch(API_BASE + '/gallery/admin/applications/' + id + '/approve', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (res.ok) { showSuccessMessage('已通过审核'); loadReviewPage(); }
        else { const data = await res.json(); showError(data.error || '操作失败'); }
    } catch (e) { showError('操作失败'); }
}

// 审核拒绝
async function rejectGalleryApp(id) {
    const reason = prompt('请输入拒绝原因（可选）：');
    if (reason === null) return;
    try {
        const res = await fetch(API_BASE + '/gallery/admin/applications/' + id + '/reject', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: reason || '' })
        });
        if (res.ok) { showSuccessMessage('已拒绝'); loadReviewPage(); }
        else { const data = await res.json(); showError(data.error || '操作失败'); }
    } catch (e) { showError('操作失败'); }
}

// 解析URL并导航到对应页面
function parseUrlAndNavigate() {
    const path = window.location.pathname;
    const search = window.location.search;
    
    // 解析URL参数
    const urlParams = new URLSearchParams(search);
    const pageParam = urlParams.get('page');
    const params = {};
    if (pageParam) params.page = parseInt(pageParam);
    
    // 根据路径确定页面
    if (path === '/' || path === '/index.html' || path === '') {
        navigateToPage('home', params);
    } else if (path.startsWith('/members')) {
        navigateToPage('members', params);
    } else if (path.startsWith('/messages')) {
        navigateToPage('messages', params);
    } else if (path.startsWith('/stories')) {
        if (path.includes('/page/')) {
            // 文章详情页的分页，如 /stories/123/page/2/
            const parts = path.split('/');
            const storyId = parts[2];
            const pageNum = parts[4];
            if (storyId) {
                showStoryDetail(storyId, { page: pageNum ? parseInt(pageNum) : 1 });
            }
        } else {
            navigateToPage('stories', params);
        }
    } else if (path.startsWith('/gallery')) {
        navigateToPage('gallery', params);
    } else {
        // 默认首页
        navigateToPage('home', params);
    }
}
