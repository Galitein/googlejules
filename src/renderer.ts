/// <reference path="renderer.d.ts" />

// --- STATE ---
let currentPage = 1;
let searchQuery = '';
let filterTag = '';

// --- SAFE ELEMENT GETTER ---
function getElem<T extends HTMLElement = HTMLElement>(id: string): T | null {
    return document.getElementById(id) as T | null;
}

// --- DOM EVENT LISTENER ---
document.addEventListener('DOMContentLoaded', () => {
    // Main elements
    const taskList = getElem('task-list');
    const tagsList = getElem('tags-list');
    const paginationContainer = getElem('pagination-container');

    // Inputs and buttons
    const taskSearchInput = getElem<HTMLInputElement>('task-search-input');
    const tagSearchInput = getElem<HTMLInputElement>('tag-search-input');
    const newTaskBtn = getElem('new-task-btn');
    const allTasksBtn = getElem('all-tasks-btn');

    // Modal elements
    const modal = getElem('task-modal');
    const modalTitle = getElem('modal-title');
    const taskForm = getElem<HTMLFormElement>('task-form');
    const taskIdInput = getElem<HTMLInputElement>('task-id-input');
    const taskTitleInput = getElem<HTMLInputElement>('task-title-input');
    const taskTagsInput = getElem<HTMLInputElement>('task-tags-input');
    const cancelBtn = getElem('cancel-btn');

    // Check for critical elements
    if (!taskList || !tagsList || !paginationContainer || !modal || !taskForm) {
        console.error('Critical UI elements are missing. Application cannot start.');
        return;
    }

    // --- RENDER FUNCTIONS ---

    const renderTasks = (tasks: Task[]) => {
        taskList.innerHTML = '';
        if (tasks.length === 0) {
            taskList.innerHTML = '<p class="no-tasks">No tasks found.</p>';
            return;
        }

        tasks.forEach(task => {
            const taskItem = document.createElement('div');
            taskItem.className = `task-item ${task.status}`;
            taskItem.dataset.taskId = String(task.id);

            taskItem.innerHTML = `
                <div class="task-status">
                    <input type="checkbox" class="task-checkbox" ${task.status === 'completed' ? 'checked' : ''}>
                </div>
                <div class="task-details">
                    <p class="task-title">${task.title}</p>
                    <div class="task-tags">
                        ${task.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                    </div>
                </div>
                <div class="task-actions">
                    <button class="btn-icon edit-btn">✏️</button>
                    <button class="btn-icon delete-btn">🗑️</button>
                </div>
            `;
            taskList.appendChild(taskItem);
        });
    };

    const renderTags = (tags: string[]) => {
        tagsList.innerHTML = '';
        tags.forEach(tag => {
            const li = document.createElement('li');
            const button = document.createElement('button');
            button.className = 'tag-btn';
            button.textContent = tag;
            button.dataset.tag = tag;
            if (tag === filterTag) {
                button.classList.add('active');
            }
            li.appendChild(button);
            tagsList.appendChild(li);
        });
    };

    const renderPagination = (total: number, page: number, limit: number) => {
        paginationContainer.innerHTML = '';
        const pageCount = Math.ceil(total / limit);
        if (pageCount <= 1) return;

        for (let i = 1; i <= pageCount; i++) {
            const button = document.createElement('button');
            button.className = 'pagination-btn';
            button.textContent = String(i);
            button.dataset.page = String(i);
            if (i === page) {
                button.classList.add('active');
            }
            paginationContainer.appendChild(button);
        }
    };

    // --- DATA FETCHING ---

    const fetchAndRenderData = async () => {
        try {
            const { tasks, total, page, limit } = await window.api.getTasks({ searchQuery, filterTag, page: currentPage });
            const allTags = await window.api.getTags();

            renderTasks(tasks);
            renderTags(allTags);
            renderPagination(total, page, limit);
            updateActiveTagButton();
        } catch (error) {
            console.error('Failed to fetch data:', error);
        }
    };

    // --- MODAL ---

    const openModal = (mode: 'create' | 'edit', task?: Partial<Task>) => {
        if (!modal || !modalTitle || !taskForm || !taskIdInput || !taskTitleInput || !taskTagsInput) return;
        modalTitle.textContent = mode === 'create' ? 'New Task' : 'Edit Task';
        taskForm.reset();
        if (mode === 'edit' && task) {
            taskIdInput.value = String(task.id || '');
            taskTitleInput.value = task.title || '';
            taskTagsInput.value = task.tags?.join(', ') || '';
        } else {
            taskIdInput.value = '';
        }
        modal.style.display = 'flex';
    };

    const closeModal = () => {
        if (modal) modal.style.display = 'none';
    };

    // --- EVENT HANDLERS ---

    const debounce = (func: Function, delay: number) => {
        let timeout: ReturnType<typeof setTimeout>;
        return function(this: any, ...args: any[]) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), delay);
        };
    };

    if (taskSearchInput) {
        taskSearchInput.addEventListener('input', debounce(() => {
            searchQuery = taskSearchInput.value;
            currentPage = 1;
            fetchAndRenderData();
        }, 300));
    }

    if (tagSearchInput) {
        tagSearchInput.addEventListener('input', () => {
            const query = tagSearchInput.value.toLowerCase();
            const tagButtons = tagsList.querySelectorAll('.tag-btn');
            tagButtons.forEach(button => {
                const li = button.parentElement!;
                const tag = button.textContent?.toLowerCase() || '';
                li.style.display = tag.includes(query) ? '' : 'none';
            });
        });
    }

    if (newTaskBtn) newTaskBtn.addEventListener('click', () => openModal('create'));
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    if (modal) modal.addEventListener('click', (e: MouseEvent) => {
        if (e.target === modal) closeModal();
    });

    taskForm.addEventListener('submit', async (e: Event) => {
        e.preventDefault();
        if (!taskTitleInput || !taskTagsInput || !taskIdInput) return;

        const title = taskTitleInput.value;
        const tags = taskTagsInput.value.split(',').map(t => t.trim()).filter(Boolean);

        // --- VALIDATION ---
        if (!title.trim()) {
            alert('Title is required.');
            return;
        }
        if (tags.length === 0) {
            alert('At least one tag is required.');
            return;
        }

        const id = taskIdInput.value ? Number(taskIdInput.value) : null;

        try {
            if (id) {
                await window.api.updateTask(id, { title, tags });
            } else {
                await window.api.createTask({ title, tags });
            }
            closeModal();
            fetchAndRenderData();
        } catch (error) {
            console.error('Failed to save task:', error);
        }
    });

    taskList.addEventListener('click', async (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const taskItem = target.closest<HTMLElement>('.task-item');
        if (!taskItem || !taskItem.dataset.taskId) return;

        const id = Number(taskItem.dataset.taskId);

        if (target.matches('.task-checkbox')) {
            const isChecked = (target as HTMLInputElement).checked;
            await window.api.updateTask(id, { status: isChecked ? 'completed' : 'pending' });
            fetchAndRenderData();
        }

        if (target.matches('.edit-btn')) {
            const titleEl = taskItem.querySelector('.task-title');
            const tagsEl = taskItem.querySelectorAll('.tag');
            if (titleEl) {
                const title = titleEl.textContent || '';
                const tags = Array.from(tagsEl).map(t => t.textContent || '').filter(Boolean);
                openModal('edit', { id, title, tags });
            }
        }

        if (target.matches('.delete-btn')) {
            if (confirm('Are you sure you want to delete this task?')) {
                await window.api.deleteTask(id);
                fetchAndRenderData();
            }
        }
    });

    tagsList.addEventListener('click', (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.matches('.tag-btn') && (target as HTMLButtonElement).dataset.tag) {
            filterTag = (target as HTMLButtonElement).dataset.tag!;
            currentPage = 1;
            fetchAndRenderData();
        }
    });

    if (allTasksBtn) {
        allTasksBtn.addEventListener('click', () => {
            filterTag = '';
            currentPage = 1;
            fetchAndRenderData();
        });
    }

    const updateActiveTagButton = () => {
        document.querySelectorAll('.sidebar .tag-btn').forEach(btn => {
            const button = btn as HTMLButtonElement;
            const isAllTasks = !filterTag && button.id === 'all-tasks-btn';
            const isMatchingTag = filterTag && button.dataset.tag === filterTag;
            button.classList.toggle('active', !!(isAllTasks || isMatchingTag));
        });
    };

    paginationContainer.addEventListener('click', (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.matches('.pagination-btn') && (target as HTMLButtonElement).dataset.page) {
            currentPage = Number((target as HTMLButtonElement).dataset.page);
            fetchAndRenderData();
        }
    });

    // --- INITIAL LOAD ---
    fetchAndRenderData();
});
