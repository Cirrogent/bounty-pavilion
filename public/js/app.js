// 全局变量
const API_BASE = '/api';
let currentUser = null;
let token = localStorage.getItem('token');

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
    
    // 加载首页数据
    loadHomePage();
    
    // 初始化模态框
    initModal();
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

// 导航到指定页面
function navigateToPage(page) {
    // 隐藏所有页面
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    
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
        
        // 加载页面数据
        loadPageData(page);
    }
}

// 加载页面数据
function loadPageData(page) {
    switch (page) {
        case 'home':
            loadHomePage();
            break;
        case 'members':
            loadMembersPage();
            break;
        case 'messages':
            loadMessagesPage();
            break;
        case 'profile':
            loadProfilePage();
            break;
        case 'review':
            loadReviewPage();
            break;
    }
}

// 加载首页数据
async function loadHomePage() {
    try {
        const response = await fetch(`${API_BASE}/modpacks`);
        if (response.ok) {
            const modpacks = await response.json();
            displayModpacks(modpacks);
        }
    } catch (error) {
        console.error('加载整合包失败:', error);
    }
}

// 显示整合包
function displayModpacks(modpacks) {
    const container = document.getElementById('modpacks-grid');
    container.innerHTML = '';
    
    modpacks.forEach(modpack => {
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
            <img src="${modpack.image_url}" alt="${modpack.name}" class="modpack-image">
        ` : `
            <div class="modpack-image" style="background-color: var(--primary-color); display: flex; align-items: center; justify-content: center; color: var(--text-secondary);">暂无图片</div>
        `}
        <div class="modpack-content">
            <h3 class="modpack-title">${modpack.name}</h3>
            <p class="modpack-description">${modpack.description}</p>
            <div class="modpack-actions">
                ${modpack.download_link ? `
                    <a href="${modpack.download_link}" target="_blank" class="btn btn-primary" onclick="event.stopPropagation()">下载</a>
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

// 加载成员页面
async function loadMembersPage() {
    try {
        const response = await fetch(`${API_BASE}/members`);
        if (response.ok) {
            const members = await response.json();
            displayMembers(members);
        }
    } catch (error) {
        console.error('加载成员失败:', error);
    }
}

// 显示成员
function displayMembers(members) {
    const container = document.getElementById('members-grid');
    container.innerHTML = '';
    
    members.forEach(member => {
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
            <img src="${member.avatar_url}" alt="${member.name}" class="member-avatar">
        ` : `
            <div class="member-avatar" style="background-color: var(--primary-color); display: flex; align-items: center; justify-content: center; color: var(--text-secondary); font-size: 36px;">?</div>
        `}
        <h3 class="member-name">${member.name}</h3>
        ${member.role ? `<p class="member-role">${member.role}</p>` : ''}
        ${member.description ? `<p style="color: var(--text-secondary); font-size: 14px; margin-top: 10px;">${member.description}</p>` : ''}
    `;
    return card;
}

// 加载留言板页面
async function loadMessagesPage() {
    try {
        const response = await fetch(`${API_BASE}/messages`);
        if (response.ok) {
            const messages = await response.json();
            displayMessages(messages);
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
            <span class="message-author">${message.username}</span>
            <span class="message-time">${time}</span>
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

// 加载个人中心页面
function loadProfilePage() {
    if (!currentUser) {
        navigateToPage('login');
        return;
    }
    
    document.getElementById('profile-username').textContent = currentUser.username;
    document.getElementById('profile-email').textContent = currentUser.email;
    document.getElementById('profile-role').textContent = currentUser.role === 'admin' ? '管理员' : '普通用户';
}

// 初始化表单
function initForms() {
    // 登录表单
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    
    // 注册表单
    document.getElementById('register-form').addEventListener('submit', handleRegister);
    
    // 留言表单
    document.getElementById('message-form').addEventListener('submit', handleMessageSubmit);
    
    // 修改密码表单
    document.getElementById('change-password-form').addEventListener('submit', handleChangePassword);
    
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
        alert('请先登录');
        return;
    }
    
    // 检查权限：只有管理员可以编辑，所有用户都可以添加
    if (modpackId && currentUser.role !== 'admin') {
        alert('只有管理员可以编辑整合包');
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
                alert('整合包更新成功！');
            } else if (currentUser.role === 'admin') {
                alert('整合包创建成功！');
            } else {
                alert('整合包已提交，等待管理员审核！');
            }
            hideModal();
            loadHomePage();
        } else {
            alert(data.error || '操作失败');
        }
    } catch (error) {
        console.error('提交整合包失败:', error);
        alert('操作失败，请稍后重试');
    }
}

// 处理成员表单提交
async function handleMemberSubmit(memberId = null) {
    if (!currentUser || currentUser.role !== 'admin') {
        alert('只有管理员可以操作');
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
            alert(memberId ? '成员更新成功！' : '成员添加成功！');
            hideModal();
            loadMembersPage();
        } else {
            alert(data.error || '操作失败');
        }
    } catch (error) {
        console.error('提交成员失败:', error);
        alert('操作失败，请稍后重试');
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
            alert('加载整合包失败');
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
            alert('加载成员失败');
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
            alert('整合包删除成功！');
            loadHomePage();
        } else {
            alert(data.error || '删除失败');
        }
    } catch (error) {
        console.error('删除整合包失败:', error);
        alert('删除失败，请稍后重试');
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
            alert('成员删除成功！');
            loadMembersPage();
        } else {
            alert(data.error || '删除失败');
        }
    } catch (error) {
        console.error('删除成员失败:', error);
        alert('删除失败，请稍后重试');
    }
}

// 申请修改整合包
function requestEdit(modpackId) {
    if (!currentUser) {
        alert('请先登录后再申请修改');
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
                alert('修改申请已提交，等待管理员审核！');
                hideModal();
            } else {
                alert(data.error || '提交失败');
            }
        } catch (error) {
            console.error('提交申请失败:', error);
            alert('提交失败，请稍后重试');
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
            
            alert('登录成功！');
            updateNavigation();
            navigateToPage('home');
            
            // 清空表单
            document.getElementById('login-form').reset();
        } else {
            alert(data.error || '登录失败');
        }
    } catch (error) {
        console.error('登录错误:', error);
        alert('登录失败，请稍后重试');
    }
}

// 处理注册
async function handleRegister(e) {
    e.preventDefault();
    
    const username = document.getElementById('register-username').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    
    try {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            token = data.token;
            currentUser = data.user;
            localStorage.setItem('token', token);
            
            alert('注册成功！');
            updateNavigation();
            navigateToPage('home');
            
            // 清空表单
            document.getElementById('register-form').reset();
        } else {
            alert(data.error || '注册失败');
        }
    } catch (error) {
        console.error('注册错误:', error);
        alert('注册失败，请稍后重试');
    }
}

// 处理留言提交
async function handleMessageSubmit(e) {
    e.preventDefault();
    
    if (!currentUser) {
        alert('请先登录');
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
            alert('留言发布成功！');
            document.getElementById('message-form').reset();
            loadMessagesPage();
        } else {
            alert(data.error || '发布失败');
        }
    } catch (error) {
        console.error('发布留言错误:', error);
        alert('发布失败，请稍后重试');
    }
}

// 处理修改密码
async function handleChangePassword(e) {
    e.preventDefault();
    
    if (!currentUser) {
        alert('请先登录');
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
            alert('密码修改成功！');
            document.getElementById('change-password-form').reset();
        } else {
            alert(data.error || '修改失败');
        }
    } catch (error) {
        console.error('修改密码错误:', error);
        alert('修改失败，请稍后重试');
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
        userMenu.innerHTML = `
            <a href="#" data-page="profile" class="nav-link">👤 ${currentUser.username}</a>
            <a href="#" onclick="handleLogout()" class="nav-link">退出</a>
        `;
        
        // 重新绑定事件
        userMenu.querySelector('[data-page="profile"]').addEventListener('click', (e) => {
            e.preventDefault();
            navigateToPage('profile');
        });
    } else {
        userMenu.innerHTML = '<a href="#" data-page="login" class="nav-link" id="login-link">登录</a>';
        userMenu.querySelector('[data-page="login"]').addEventListener('click', (e) => {
            e.preventDefault();
            navigateToPage('login');
        });
    }
}

// 更新管理员功能
function updateAdminFeatures() {
    const addModpackBtn = document.getElementById('add-modpack-btn');
    const addMemberBtn = document.getElementById('add-member-btn');
    
    if (currentUser) {
        // 所有登录用户都可以添加整合包
        addModpackBtn.style.display = 'block';
        
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
    }
}

// 加载审核页面（管理员）
async function loadReviewPage() {
    if (!currentUser || currentUser.role !== 'admin') {
        alert('需要管理员权限');
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
            alert('加载待审核整合包失败');
        }
    } catch (error) {
        console.error('加载审核列表失败:', error);
        alert('加载审核列表失败');
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
            alert('整合包已批准发布！');
            loadReviewPage();
            loadHomePage();
        } else {
            alert(data.error || '操作失败');
        }
    } catch (error) {
        console.error('批准整合包失败:', error);
        alert('操作失败');
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
            alert('整合包已拒绝并删除');
            loadReviewPage();
        } else {
            alert(data.error || '操作失败');
        }
    } catch (error) {
        console.error('拒绝整合包失败:', error);
        alert('操作失败');
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
    loadComments(modpack.id);
    
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

// 加载评论
async function loadComments(modpackId) {
    const container = document.getElementById('comments-list');
    container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">加载评论中...</p>';
    
    try {
        const response = await fetch(`${API_BASE}/comments/modpack/${modpackId}`);
        
        if (response.ok) {
            const comments = await response.json();
            displayComments(comments);
        } else {
            container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">加载评论失败</p>';
        }
    } catch (error) {
        console.error('加载评论失败:', error);
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">加载评论失败</p>';
    }
}

// 显示评论列表
function displayComments(comments) {
    const container = document.getElementById('comments-list');
    container.innerHTML = '';
    
    if (comments.length === 0) {
        container.innerHTML = '<p class="no-comments">暂无评论，快来发表第一条评论吧！</p>';
        return;
    }
    
    comments.forEach(comment => {
        const commentEl = document.createElement('div');
        commentEl.className = 'comment-item';
        
        const time = new Date(comment.created_at).toLocaleString('zh-CN');
        
        commentEl.innerHTML = `
            <div class="comment-header">
                <span class="comment-author">${comment.username}</span>
                <span class="comment-time">${time}</span>
            </div>
            <div class="comment-content">${comment.content}</div>
        `;
        
        container.appendChild(commentEl);
    });
}

// 发表评论
async function submitComment() {
    if (!currentUser) {
        alert('请先登录后再发表评论');
        navigateToPage('login');
        return;
    }
    
    const panel = document.getElementById('modpack-detail-panel');
    const modpackId = panel.dataset.modpackId;
    const content = document.getElementById('comment-input').value.trim();
    
    if (!content) {
        alert('请输入评论内容');
        return;
    }
    
    if (content.length > 500) {
        alert('评论内容不能超过500字');
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
            loadComments(modpackId);
        } else {
            alert(data.error || '发表评论失败');
        }
    } catch (error) {
        console.error('发表评论失败:', error);
        alert('发表评论失败');
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
    submitBtn.addEventListener('click', submitComment);
    
    // 回车键发表评论
    document.getElementById('comment-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submitComment();
        }
    });
}

// ==================== AI聊天机器人 ====================

// 预设问答库
const presetQA = {
    '你好': '你好！我是大川，很高兴为你服务~',
    'hi': 'Hello! 有什么可以帮助你的吗？',
    'hello': '你好！欢迎来到赏金阁！',
    '你是谁': '我是大川，赏金阁的智能助手，专门回答关于Minecraft的问题！',
    '大川': '在呢！有什么想问的吗？',
    'modpack': '整合包是Modpack的中文翻译，指包含多个MOD的Minecraft游戏包。你可以在赏金阁找到很多优质整合包！',
    '整合包': '整合包能让你一次性体验多个MOD的组合玩法。推荐你浏览我们的整合包列表，找到感兴趣的下载试试！',
    'minecraft': 'Minecraft（我的世界）是一款超好玩的沙盒游戏！在赏金阁我们专注于分享各种整合包。',
    '我的世界': '《我的世界》是Minecraft的中文译名。需要我帮你推荐整合包吗？',
    '怎么下载': '点击整合包的"下载"按钮即可跳转到下载页面。如果是普通用户提交的整合包，需要等待管理员审核通过。',
    '审核': '普通用户提交的整合包需要管理员审核。审核通过后才会显示在首页。',
    '管理员': '管理员可以管理整合包、成员，审核用户提交的内容。默认管理员账号是admin/admin123，登录后请立即修改密码！',
    '密码': '如果你是管理员，请及时修改默认密码admin123！',
    '感谢': '不客气！有问题随时找我~',
    '谢谢': '不用谢！祝你游戏愉快！',
    '再见': '再见！记得常来赏金阁看看哦~',
    '拜拜': '拜拜！玩得开心！'
};

// 初始化聊天机器人
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
    
    // 检查预设问答
    const presetAnswer = getPresetAnswer(message);
    if (presetAnswer) {
        setTimeout(() => {
            addChatMessage(presetAnswer, 'bot');
        }, 500);
        return;
    }
    
    // 调用AI API
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

// 获取预设回答
function getPresetAnswer(message) {
    const lowerMsg = message.toLowerCase();
    
    // 检查关键词匹配
    for (const [key, answer] of Object.entries(presetQA)) {
        if (lowerMsg.includes(key.toLowerCase())) {
            return answer;
        }
    }
    
    return null;
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
    const music = document.getElementById('background-music');
    
    // 尝试播放音乐（需要用户交互）
    document.addEventListener('click', () => {
        if (music.paused) {
            music.volume = 0.3; // 设置音量为30%
            music.play().catch(e => {
                console.log('自动播放被阻止:', e);
            });
        }
    }, { once: true });
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

// 初始化所有功能
function initAllFeatures() {
    initCommentPanel();
    initChatbot();
    playBackgroundMusic();
}

// 初始化时调用
initAllFeatures();

// 全局方法（供HTML调用）
window.app = {
    navigate: navigateToPage
};
